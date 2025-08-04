// controllers/rental_products_controller.js
const supabase = require("../db/supabase");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const controller = {};

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("=== MULTER FILE FILTER ===");
    console.log("File received in filter:", file);
    console.log("Field name:", file.fieldname);

    // Check if file is an image
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Helper function to upload image to Supabase Storage
const uploadImageToStorage = async (file, folder = "rental-products") => {
  try {
    // Generate unique filename
    const fileExt = file.originalname.split(".").pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("rental-products") // Create this bucket in Supabase
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("rental-products").getPublicUrl(filePath);

    return {
      success: true,
      filePath: data.path,
      publicUrl: publicUrl,
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Helper function to delete image from storage
const deleteImageFromStorage = async (filePath) => {
  try {
    const { error } = await supabase.storage
      .from("rental-products")
      .remove([filePath]);

    if (error) {
      console.error("Delete file error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Delete file error:", error);
    return false;
  }
};

// CREATE - Add new rental product with image upload
controller.createRentalProduct = async (req, res) => {
  try {
    const { name, description, price, rental_id, location, contact, is_ready } =
      req.body;
    const file = req.file;

    console.log("=== CREATE RENTAL PRODUCT DEBUG ===");
    console.log("Request body:", req.body);
    console.log("File:", file);

    // Validate required fields
    if (!name || !rental_id || !price) {
      return res.status(400).json({
        success: false,
        message: "Name, rental_id, and price are required",
      });
    }

    // Prepare insert data
    const insertData = {
      name: name.trim(),
      description: description ? description.trim() : "",
      price: parseFloat(price),
      rental_id: parseInt(rental_id),
      location: location ? location.trim() : "",
      contact: contact ? contact.trim() : "",
      is_ready: is_ready === "true" || is_ready === true,
    };

    let productImageUrl = null;
    let uploadedFilePath = null;

    // Handle product image file upload if present
    if (file) {
      console.log("Processing product image upload...");

      const uploadResult = await uploadImageToStorage(file);

      if (!uploadResult.success) {
        console.error("Upload error:", uploadResult.error);
        return res.status(500).json({
          success: false,
          message: "Failed to upload product image",
          error: uploadResult.error,
        });
      }

      productImageUrl = uploadResult.publicUrl;
      uploadedFilePath = uploadResult.filePath;
      insertData.banner = productImageUrl;
    }

    console.log("Insert data:", insertData);

    // Insert new rental product
    const { data, error } = await supabase
      .from("rental_products") // assuming your table name
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      // If database insert fails, delete the uploaded image
      if (uploadedFilePath) {
        await deleteImageFromStorage(uploadedFilePath);
      }

      console.error("Create rental product error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create rental product",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Rental product created successfully",
      data,
      file_path: uploadedFilePath,
    });
  } catch (error) {
    console.error("Create rental product error:", error);

    if (uploadedFilePath) {
      try {
        await deleteImageFromStorage(uploadedFilePath);
      } catch (cleanupError) {
        console.error("Error cleaning up uploaded file:", cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update rental product with optional image replacement
controller.updateRentalProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, rental_id, location, contact, is_ready } =
      req.body;
    const file = req.file;

    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from("rental_products")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Rental product not found",
      });
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (price !== undefined) {
      if (price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be greater than 0",
        });
      }
      updateData.price = parseInt(price);
    }
    if (rental_id !== undefined) {
      // Validate rental exists
      const { data: rental, error: rentalError } = await supabase
        .from("rental")
        .select("id")
        .eq("id", rental_id)
        .single();

      if (rentalError || !rental) {
        return res.status(400).json({
          success: false,
          message: "Invalid rental_id. Rental not found",
        });
      }
      updateData.rental_id = parseInt(rental_id);
    }
    if (location !== undefined) updateData.location = location.trim();
    if (contact !== undefined) updateData.contact = contact.trim();
    if (is_ready !== undefined) updateData.is_ready = is_ready;

    let newImageUrl = null;
    let oldImagePath = null;

    // Handle image upload if new file provided
    if (file) {
      const uploadResult = await uploadImageToStorage(file);

      if (!uploadResult.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload new image",
          error: uploadResult.error,
        });
      }

      updateData.banner = uploadResult.publicUrl;
      newImageUrl = uploadResult.publicUrl;

      // Extract old image path for deletion
      if (existingProduct.banner) {
        const urlParts = existingProduct.banner.split("/");
        const fileName = urlParts[urlParts.length - 1];
        oldImagePath = `rental-products/${fileName}`;
      }
    }

    // Validate at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    // Update product
    const { data, error } = await supabase
      .from("rental_products")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        rental:rental_id (id, name)
      `
      )
      .single();

    if (error) {
      // If update fails and new image was uploaded, delete it
      if (newImageUrl) {
        const urlParts = newImageUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        await deleteImageFromStorage(`rental-products/${fileName}`);
      }

      console.error("Update rental product error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update rental product",
        error: error.message,
      });
    }

    // Delete old image if new one was uploaded successfully
    if (oldImagePath && newImageUrl) {
      await deleteImageFromStorage(oldImagePath);
    }

    res.json({
      success: true,
      message: "Rental product updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update rental product error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE - Delete rental product and its image
controller.deleteRentalProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from("rental_products")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Rental product not found",
      });
    }

    // Delete product from database
    const { error: deleteError } = await supabase
      .from("rental_products")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete rental product error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete rental product",
        error: deleteError.message,
      });
    }

    // Delete image from storage if exists
    if (existingProduct.banner) {
      const urlParts = existingProduct.banner.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const imagePath = `rental-products/${fileName}`;

      const imageDeleted = await deleteImageFromStorage(imagePath);
      if (!imageDeleted) {
        console.warn(`Failed to delete image: ${imagePath}`);
      }
    }

    res.json({
      success: true,
      message: "Rental product deleted successfully",

      deletedProduct: existingProduct,
    });
  } catch (error) {
    console.error("Delete rental product error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all rental products
controller.getAllRentalProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      rental_id,
      is_ready,
      min_price,
      max_price,
      location,
    } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("rental_products")
      .select(
        `
        *,
        rental:rental_id (id, name)
      `,
        { count: "exact" }
      )
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    // Add filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (rental_id) {
      query = query.eq("rental_id", rental_id);
    }

    if (is_ready !== undefined) {
      query = query.eq("is_ready", is_ready === "true");
    }

    if (min_price) {
      query = query.gte("price", parseInt(min_price));
    }

    if (max_price) {
      query = query.lte("price", parseInt(max_price));
    }

    if (location) {
      query = query.ilike("location", `%${location}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get rental products error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch rental products",
        error: error.message,
      });
    }

    res.json({
      success: true,
      data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Get rental products error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get rental product by ID
controller.getRentalProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("rental_products")
      .select(
        `
        *,
        rental:rental_id (id, name, banner)
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Rental product not found",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get rental product by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all rental products
controller.getAllRentalProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      rental_id,
      is_ready,
      min_price,
      max_price,
      location,
    } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("rental_products")
      .select(
        `
        *,
        rental:rental_id (id, name)
      `,
        { count: "exact" }
      )
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    // Add filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (rental_id) {
      query = query.eq("rental_id", rental_id);
    }

    if (is_ready !== undefined) {
      query = query.eq("is_ready", is_ready === "true");
    }

    if (min_price) {
      query = query.gte("price", parseInt(min_price));
    }

    if (max_price) {
      query = query.lte("price", parseInt(max_price));
    }

    if (location) {
      query = query.ilike("location", `%${location}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get rental products error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch rental products",
        error: error.message,
      });
    }

    res.json({
      success: true,
      data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Get rental products error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get rental product by ID
controller.getRentalProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("rental_products")
      .select(
        `
        *,
        rental:rental_id (id, name, banner)
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Rental product not found",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get rental product by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { controller, upload };
