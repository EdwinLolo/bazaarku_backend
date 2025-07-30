// controllers/banner_controller.js
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
    // Check if file is an image
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Helper function to upload image to Supabase Storage
const uploadImageToStorage = async (file, folder = "banners") => {
  try {
    // Generate unique filename
    const fileExt = file.originalname.split(".").pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("banners")
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
    } = supabase.storage.from("banners").getPublicUrl(filePath);

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
    const { error } = await supabase.storage.from("banners").remove([filePath]);

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

// CREATE - Add new banner with image upload
controller.createBanner = async (req, res) => {
  try {
    const { name, link } = req.body;
    const file = req.file;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
    }

    // Upload image to storage
    const uploadResult = await uploadImageToStorage(file);

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload image",
        error: uploadResult.error,
      });
    }

    // Insert banner record
    const { data, error } = await supabase
      .from("banner_home")
      .insert({
        name: name.trim(),
        banner: uploadResult.publicUrl,
        link: link?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      // If database insert fails, delete the uploaded image
      await deleteImageFromStorage(uploadResult.filePath);

      console.error("Create banner error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create banner",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: {
        ...data,
        file_path: uploadResult.filePath,
      },
    });
  } catch (error) {
    console.error("Create banner error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all banners
controller.getAllBanners = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, active_only = false } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("banner_home")
      .select("*", { count: "exact" })
      .order("id", { ascending: false }) // Latest first
      .range(offset, offset + limit - 1);

    // Add search functionality
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get banners error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch banners",
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
    console.error("Get banners error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get banner by ID
controller.getBannerById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("banner_home")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get banner by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update banner (with optional image replacement)
controller.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, link } = req.body;
    const file = req.file;

    // Check if banner exists
    const { data: existingBanner, error: fetchError } = await supabase
      .from("banner_home")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingBanner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (link !== undefined) updateData.link = link?.trim() || null;

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
      if (existingBanner.banner) {
        const urlParts = existingBanner.banner.split("/");
        const fileName = urlParts[urlParts.length - 1];
        oldImagePath = `banners/${fileName}`;
      }
    }

    // Validate at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    // Update banner
    const { data, error } = await supabase
      .from("banner_home")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      // If update fails and new image was uploaded, delete it
      if (newImageUrl) {
        const urlParts = newImageUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        await deleteImageFromStorage(`banners/${fileName}`);
      }

      console.error("Update banner error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update banner",
        error: error.message,
      });
    }

    // Delete old image if new one was uploaded successfully
    if (oldImagePath && newImageUrl) {
      await deleteImageFromStorage(oldImagePath);
    }

    res.json({
      success: true,
      message: "Banner updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update banner error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE - Delete banner and its image
controller.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if banner exists
    const { data: existingBanner, error: fetchError } = await supabase
      .from("banner_home")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingBanner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Delete banner from database
    const { error: deleteError } = await supabase
      .from("banner_home")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete banner error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete banner",
        error: deleteError.message,
      });
    }

    // Delete image from storage
    if (existingBanner.banner) {
      const urlParts = existingBanner.banner.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const imagePath = `banners/${fileName}`;

      const imageDeleted = await deleteImageFromStorage(imagePath);
      if (!imageDeleted) {
        console.warn(`Failed to delete image: ${imagePath}`);
      }
    }

    res.json({
      success: true,
      message: "Banner deleted successfully",
      data: {
        deletedBanner: existingBanner,
      },
    });
  } catch (error) {
    console.error("Delete banner error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get active banners for homepage (public endpoint)
controller.getActiveBanners = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const { data, error } = await supabase
      .from("banner_home")
      .select("*")
      .order("id", { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error("Get active banners error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch active banners",
        error: error.message,
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get active banners error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { controller, upload };
