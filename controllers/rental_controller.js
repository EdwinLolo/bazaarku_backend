const express = require("express");
const supabase = require("../db/supabase");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const controller = {};

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
const uploadImageToStorage = async (file, folder = "rental-category") => {
  try {
    // Generate unique filename
    const fileExt = file.originalname.split(".").pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("rental-category") // Create this bucket in Supabase
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
    } = supabase.storage.from("rental-category").getPublicUrl(filePath);

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
      .from("rental-category")
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

// controllers/rental_controller.js - Add this method
controller.getAllRentalsWithProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      include_products = true,
      products_limit = 5,
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabase
      .from("rental")
      .select(
        `
        *,
        rental_products (
          id,
          name,
          description,
          price,
          location,
          contact,
          banner,
          is_ready
        )
      `,
        { count: "exact" }
      )
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    // Add search functionality for rental names
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get rentals with products error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch rentals with products",
        error: error.message,
      });
    }

    // Process data to add summary statistics
    const processedData = data.map((rental) => ({
      ...rental,
      products_count: rental.rental_products.length,
      available_products: rental.rental_products.filter((p) => p.is_ready)
        .length,
      total_products: rental.rental_products.length,
      price_range:
        rental.rental_products.length > 0
          ? {
              min: Math.min(...rental.rental_products.map((p) => p.price)),
              max: Math.max(...rental.rental_products.map((p) => p.price)),
            }
          : null,
      // Limit products if specified
      rental_products: products_limit
        ? rental.rental_products.slice(0, parseInt(products_limit))
        : rental.rental_products,
    }));

    res.json({
      success: true,
      data: processedData,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Get rentals with products error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Enhanced single rental with all products
controller.getRentalWithAllProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      products_page = 1,
      products_limit = 10,
      is_ready,
      min_price,
      max_price,
    } = req.query;

    const productsOffset = (products_page - 1) * products_limit;

    // Get rental basic info
    const { data: rental, error: rentalError } = await supabase
      .from("rental")
      .select("*")
      .eq("id", id)
      .single();

    if (rentalError || !rental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found",
      });
    }

    // Build products query with filters
    let productsQuery = supabase
      .from("rental_products")
      .select("*", { count: "exact" })
      .eq("rental_id", id)
      .order("id", { ascending: true })
      .range(productsOffset, productsOffset + products_limit - 1);

    // Apply filters
    if (is_ready !== undefined) {
      productsQuery = productsQuery.eq("is_ready", is_ready === "true");
    }

    if (min_price) {
      productsQuery = productsQuery.gte("price", parseInt(min_price));
    }

    if (max_price) {
      productsQuery = productsQuery.lte("price", parseInt(max_price));
    }

    const {
      data: products,
      error: productsError,
      count: productsCount,
    } = await productsQuery;

    if (productsError) {
      console.error("Get rental products error:", productsError);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch rental products",
        error: productsError.message,
      });
    }

    // Get statistics
    const { data: stats } = await supabase
      .from("rental_products")
      .select("price, is_ready")
      .eq("rental_id", id);

    const statistics = {
      total_products: stats.length,
      available_products: stats.filter((p) => p.is_ready).length,
      unavailable_products: stats.filter((p) => !p.is_ready).length,
      price_range:
        stats.length > 0
          ? {
              min: Math.min(...stats.map((p) => p.price)),
              max: Math.max(...stats.map((p) => p.price)),
              average: Math.round(
                stats.reduce((sum, p) => sum + p.price, 0) / stats.length
              ),
            }
          : null,
    };

    res.json({
      success: true,
      data: {
        ...rental,
        rental_products: products,
        statistics,
      },
      products_pagination: {
        total: productsCount,
        page: parseInt(products_page),
        limit: parseInt(products_limit),
        totalPages: Math.ceil(productsCount / products_limit),
      },
    });
  } catch (error) {
    console.error("Get rental with products error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get rental summary (just counts, no full product details)
controller.getRentalSummary = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("rental")
      .select(
        `
        id,
        name,
        banner,
        rental_products (
          id,
          price,
          is_ready
        )
      `
      )
      .order("id", { ascending: true });

    if (error) {
      console.error("Get rental summary error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch rental summary",
        error: error.message,
      });
    }

    const summary = data.map((rental) => ({
      id: rental.id,
      name: rental.name,
      banner: rental.banner,
      statistics: {
        total_products: rental.rental_products.length,
        available_products: rental.rental_products.filter((p) => p.is_ready)
          .length,
        unavailable_products: rental.rental_products.filter((p) => !p.is_ready)
          .length,
        price_range:
          rental.rental_products.length > 0
            ? {
                min: Math.min(...rental.rental_products.map((p) => p.price)),
                max: Math.max(...rental.rental_products.map((p) => p.price)),
                average: Math.round(
                  rental.rental_products.reduce((sum, p) => sum + p.price, 0) /
                    rental.rental_products.length
                ),
              }
            : null,
      },
    }));

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Get rental summary error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

controller.createRental = async (req, res) => {
  try {
    const { name } = req.body;
    const file = req.file; // Using req.file for single file upload

    console.log("=== CREATE RENTAL DEBUG ===");
    console.log("Request body:", req.body);
    console.log("File:", file);
    console.log("Content-Type:", req.headers["content-type"]);

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    // Prepare insert data
    const insertData = {
      name: name.trim(),
    };

    let bannerUrl = null;
    let uploadedFilePath = null;

    // Handle banner file upload if present
    if (file) {
      console.log("Processing file upload...");
      console.log("File details:", {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      const uploadResult = await uploadImageToStorage(file, "rentals/banners");

      if (!uploadResult.success) {
        console.error("Upload error:", uploadResult.error);
        return res.status(500).json({
          success: false,
          message: "Failed to upload banner image",
          error: uploadResult.error,
        });
      }

      bannerUrl = uploadResult.publicUrl;
      uploadedFilePath = uploadResult.filePath;
      insertData.banner = bannerUrl;
    }

    console.log("Insert data:", insertData);

    // Insert new rental
    const { data, error } = await supabase
      .from("rental")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      // If database insert fails, delete the uploaded image
      if (uploadedFilePath) {
        await deleteImageFromStorage(uploadedFilePath);
      }

      console.error("Create rental error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create rental",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Rental created successfully",
      data,
      file_path: uploadedFilePath,
    });
  } catch (error) {
    console.error("Create rental error:", error);

    // Clean up uploaded file if there was an error
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

// READ - Get all rentals
controller.getAllRentals = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("rental")
      .select("*", { count: "exact" })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    // Add search functionality
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get rentals error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch rentals",
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
    console.error("Get rentals error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get rental by ID with products
controller.getRentalById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get rental with its products
    const { data: rental, error: rentalError } = await supabase
      .from("rental")
      .select(
        `
        *,
        rental_products (*)
      `
      )
      .eq("id", id)
      .single();

    if (rentalError || !rental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found",
      });
    }

    res.json({
      success: true,
      data: rental,
    });
  } catch (error) {
    console.error("Get rental by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update rental
controller.updateRental = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, banner, remove_banner } = req.body;
    const file = req.file;

    console.log("=== UPDATE RENTAL DEBUG ===");
    console.log("Rental ID:", id);
    console.log("Request body:", req.body);
    console.log("File:", file);

    // Check if rental exists
    const { data: existingRental, error: fetchError } = await supabase
      .from("rental")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found",
      });
    }

    // Prepare update data
    const updateData = {};

    if (name !== undefined && name.toString().trim()) {
      updateData.name = name.toString().trim();
    }

    let newImageUrl = null;
    let oldImagePath = null;
    let uploadedFilePath = null;

    // Handle banner removal
    if (remove_banner === "true" || remove_banner === true) {
      updateData.banner = null;
      if (existingRental.banner) {
        try {
          const urlParts = existingRental.banner.split("/");
          const fileName = urlParts[urlParts.length - 1];
          oldImagePath = `rentals/banners/${fileName}`;
        } catch (error) {
          console.error("Error parsing old image path:", error);
        }
      }
    }

    // Handle new file upload
    if (file && !remove_banner) {
      console.log("Processing new file upload for update...");

      const uploadResult = await uploadImageToStorage(file, "rentals/banners");

      if (!uploadResult.success) {
        console.error("Upload failed:", uploadResult.error);
        return res.status(500).json({
          success: false,
          message: "Failed to upload new banner image",
          error: uploadResult.error,
        });
      }

      updateData.banner = uploadResult.publicUrl;
      newImageUrl = uploadResult.publicUrl;
      uploadedFilePath = uploadResult.filePath;

      // Mark old image for deletion if it exists
      if (existingRental.banner) {
        try {
          const urlParts = existingRental.banner.split("/");
          const fileName = urlParts[urlParts.length - 1];
          oldImagePath = `rentals/banners/${fileName}`;
        } catch (error) {
          console.error("Error parsing old image path:", error);
        }
      }
    } else if (
      banner !== undefined &&
      banner.toString().trim() &&
      !remove_banner &&
      !file
    ) {
      // Handle banner URL update
      const bannerStr = banner.toString().trim();
      if (bannerStr !== existingRental.banner) {
        console.log("Updating banner URL...");
        updateData.banner = bannerStr;

        if (
          existingRental.banner &&
          existingRental.banner.includes("supabase")
        ) {
          try {
            const urlParts = existingRental.banner.split("/");
            const fileName = urlParts[urlParts.length - 1];
            oldImagePath = `rentals/banners/${fileName}`;
          } catch (error) {
            console.error("Error parsing old image path:", error);
          }
        }
      }
    }

    // Validate at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    console.log("Final update data:", updateData);

    // Update rental in database
    const { data, error } = await supabase
      .from("rental")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Database update error:", error);

      // Clean up uploaded file if database update failed
      if (uploadedFilePath) {
        try {
          await deleteImageFromStorage(uploadedFilePath);
        } catch (cleanupError) {
          console.error("Error cleaning up uploaded file:", cleanupError);
        }
      }

      return res.status(500).json({
        success: false,
        message: "Failed to update rental",
        error: error.message,
      });
    }

    // Delete old image only after successful database update
    if (oldImagePath && (newImageUrl || remove_banner)) {
      try {
        console.log("Deleting old image:", oldImagePath);
        await deleteImageFromStorage(oldImagePath);
        console.log("Old image deleted successfully");
      } catch (deleteError) {
        console.error("Error deleting old image:", deleteError);
        // Don't fail the update if old image deletion fails
      }
    }

    res.json({
      success: true,
      message: "Rental updated successfully",
      data,
      file_path: uploadedFilePath,
    });
  } catch (error) {
    console.error("Update rental error:", error);

    // Clean up uploaded file if there was an error
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

// DELETE - Delete rental
controller.deleteRental = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if rental exists
    const { data: existingRental, error: fetchError } = await supabase
      .from("rental")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found",
      });
    }

    // Check if rental has products
    const { data: products, error: productsError } = await supabase
      .from("rental_products")
      .select("id")
      .eq("rental_id", id);

    if (productsError) {
      console.error("Check products error:", productsError);
      return res.status(500).json({
        success: false,
        message: "Failed to check rental products",
      });
    }

    // Delete rental (products will be cascade deleted)
    const { error: deleteError } = await supabase
      .from("rental")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete rental error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete rental",
        error: deleteError.message,
      });
    }

    if (existingRental.banner) {
      const urlParts = existingRental.banner.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const bannerPath = `rentals/banners/${fileName}`;

      const bannerDeleted = await deleteImageFromStorage(bannerPath);
      if (!bannerDeleted) {
        console.warn(`Failed to delete banner: ${bannerPath}`);
      }
    }

    res.json({
      success: true,
      message: "Rental deleted successfully",
      ental: existingRental,
      deletedProductsCount: products.length,
    });
  } catch (error) {
    console.error("Delete rental error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { controller, upload };
