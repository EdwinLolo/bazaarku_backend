// controllers/vendor_controller.js
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
const uploadImageToStorage = async (file, folder = "vendor-banners") => {
  try {
    // Generate unique filename
    const fileExt = file.originalname.split(".").pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("vendors") // Create this bucket in Supabase
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
    } = supabase.storage.from("vendors").getPublicUrl(filePath);

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
    const { error } = await supabase.storage.from("vendors").remove([filePath]);

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

// Helper function to validate phone number
const validatePhone = (phone) => {
  // Indonesian phone number validation (basic)
  const phoneStr = phone.toString();
  return (
    phoneStr.length >= 10 && phoneStr.length <= 15 && /^\d+$/.test(phoneStr)
  );
};

// Helper function to validate Instagram URL/username
const validateInstagram = (insta) => {
  if (!insta) return false;

  // Allow both username and full URL
  const instagramRegex =
    /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{1,30})\/?$|^@?([a-zA-Z0-9._]{1,30})$/;
  return instagramRegex.test(insta);
};

// CREATE - Add new vendor
controller.createVendor = async (req, res) => {
  try {
    const { name, user_id, desc, phone, insta } = req.body;
    const file = req.file;

    // Validate required fields
    if (!name || !user_id || !desc || !phone || !insta) {
      return res.status(400).json({
        success: false,
        message:
          "Name, user_id, description, phone, and instagram are required",
      });
    }

    // Validate phone number
    if (!validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
      });
    }

    // Validate Instagram
    if (!validateInstagram(insta)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Instagram username or URL",
      });
    }

    // Check if user exists and has vendor role
    const { data: user, error: userError } = await supabase
      .from("user")
      .select("id, role, first_name, last_name")
      .eq("id", user_id)
      .single();

    if (userError || !user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "vendor" && user.role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "User must have vendor or admin role",
      });
    }

    // Check if user already has a vendor profile
    const { data: existingVendor, error: vendorCheckError } = await supabase
      .from("vendor")
      .select("id")
      .eq("user_id", user_id)
      .single();

    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: "User already has a vendor profile",
        existing_vendor_id: existingVendor.id,
      });
    }

    // Handle banner upload
    let bannerUrl = null;
    let uploadedFilePath = null;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
    }

    const uploadResult = await uploadImageToStorage(file);

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload banner image",
        error: uploadResult.error,
      });
    }

    bannerUrl = uploadResult.publicUrl;
    uploadedFilePath = uploadResult.filePath;

    // Generate vendor ID
    const vendorId = uuidv4();

    // Format Instagram (ensure it's stored consistently)
    let formattedInsta = insta;
    if (insta.includes("instagram.com/")) {
      formattedInsta = insta.split("instagram.com/")[1].replace("/", "");
    } else if (insta.startsWith("@")) {
      formattedInsta = insta.substring(1);
    }

    // Insert new vendor
    const { data, error } = await supabase
      .from("vendor")
      .insert({
        id: vendorId,
        name: name.trim(),
        user_id: user_id,
        banner: bannerUrl,
        desc: desc.trim(),
        phone: parseInt(phone),
        insta: formattedInsta,
      })
      .select(
        `
        *,
        user:user_id (id, first_name, last_name, email, role)
      `
      )
      .single();

    if (error) {
      // If database insert fails, delete the uploaded image
      if (uploadedFilePath) {
        await deleteImageFromStorage(uploadedFilePath);
      }

      console.error("Create vendor error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create vendor",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      data: {
        ...data,
        file_path: uploadedFilePath,
      },
    });
  } catch (error) {
    console.error("Create vendor error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all vendors
controller.getAllVendors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sort_by = "name",
      sort_order = "asc",
    } = req.query;

    const offset = (page - 1) * limit;

    // Validate sort parameters
    const allowedSortBy = ["id", "name", "phone"];
    const allowedSortOrder = ["asc", "desc"];

    const sortBy = allowedSortBy.includes(sort_by) ? sort_by : "name";
    const sortOrder = allowedSortOrder.includes(sort_order)
      ? sort_order
      : "asc";

    let query = supabase
      .from("vendor")
      .select(
        `
        *,
        user:user_id (id, first_name, last_name, email, role)
      `,
        { count: "exact" }
      )
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    // Add search functionality
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,desc.ilike.%${search}%,insta.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get vendors error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch vendors",
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
    console.error("Get vendors error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get vendor by ID
controller.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("vendor")
      .select(
        `
        *,
        user:user_id (id, first_name, last_name, email, role),
        event:vendor_id (
          id,
          name,
          price,
          start_date,
          end_date,
          location
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...data,
        events_count: data.event ? data.event.length : 0,
        instagram_url: `https://instagram.com/${data.insta}`,
      },
    });
  } catch (error) {
    console.error("Get vendor by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get vendor by user ID
controller.getVendorByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data, error } = await supabase
      .from("vendor")
      .select(
        `
        *,
        user:user_id (id, first_name, last_name, email, role),
        event:vendor_id (
          id,
          name,
          price,
          start_date,
          end_date,
          location
        )
      `
      )
      .eq("user_id", user_id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found for this user",
      });
    }

    res.json({
      success: true,
      data: {
        ...data,
        events_count: data.event ? data.event.length : 0,
        instagram_url: `https://instagram.com/${data.insta}`,
      },
    });
  } catch (error) {
    console.error("Get vendor by user ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update vendor
controller.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, desc, phone, insta } = req.body;
    const file = req.file;

    // Check if vendor exists
    const { data: existingVendor, error: fetchError } = await supabase
      .from("vendor")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Prepare update data
    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (desc !== undefined) updateData.desc = desc.trim();

    if (phone !== undefined) {
      if (!validatePhone(phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format",
        });
      }
      updateData.phone = parseInt(phone);
    }

    if (insta !== undefined) {
      if (!validateInstagram(insta)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Instagram username or URL",
        });
      }

      // Format Instagram
      let formattedInsta = insta;
      if (insta.includes("instagram.com/")) {
        formattedInsta = insta.split("instagram.com/")[1].replace("/", "");
      } else if (insta.startsWith("@")) {
        formattedInsta = insta.substring(1);
      }
      updateData.insta = formattedInsta;
    }

    let newImageUrl = null;
    let oldImagePath = null;

    // Handle image upload if new file provided
    if (file) {
      const uploadResult = await uploadImageToStorage(file);

      if (!uploadResult.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload new banner image",
          error: uploadResult.error,
        });
      }

      updateData.banner = uploadResult.publicUrl;
      newImageUrl = uploadResult.publicUrl;

      // Extract old image path for deletion
      if (existingVendor.banner) {
        const urlParts = existingVendor.banner.split("/");
        const fileName = urlParts[urlParts.length - 1];
        oldImagePath = `vendor-banners/${fileName}`;
      }
    }

    // Validate at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    // Update vendor
    const { data, error } = await supabase
      .from("vendor")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        user:user_id (id, first_name, last_name, email, role)
      `
      )
      .single();

    if (error) {
      // If update fails and new image was uploaded, delete it
      if (newImageUrl) {
        const urlParts = newImageUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        await deleteImageFromStorage(`vendor-banners/${fileName}`);
      }

      console.error("Update vendor error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update vendor",
        error: error.message,
      });
    }

    // Delete old image if new one was uploaded successfully
    if (oldImagePath && newImageUrl) {
      await deleteImageFromStorage(oldImagePath);
    }

    res.json({
      success: true,
      message: "Vendor updated successfully",
      data: {
        ...data,
        instagram_url: `https://instagram.com/${data.insta}`,
      },
    });
  } catch (error) {
    console.error("Update vendor error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE - Delete vendor
controller.deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.query;

    // Check if vendor exists
    const { data: existingVendor, error: fetchError } = await supabase
      .from("vendor")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Check if vendor has associated events
    const { data: associatedEvents, error: eventsError } = await supabase
      .from("event")
      .select("id, name")
      .eq("vendor_id", id)
      .limit(5);

    if (eventsError) {
      console.error("Check associated events error:", eventsError);
      return res.status(500).json({
        success: false,
        message: "Failed to check associated events",
        error: eventsError.message,
      });
    }

    // If has associated events and not force delete, return error
    if (associatedEvents && associatedEvents.length > 0 && force !== "true") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete vendor with associated events",
        associated_events_count: associatedEvents.length,
        sample_events: associatedEvents,
        suggestion:
          "Use ?force=true to delete anyway (this will affect associated events)",
      });
    }

    // Delete vendor from database
    const { error: deleteError } = await supabase
      .from("vendor")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete vendor error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete vendor",
        error: deleteError.message,
      });
    }

    // Delete banner image from storage if exists
    if (existingVendor.banner) {
      const urlParts = existingVendor.banner.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const imagePath = `vendor-banners/${fileName}`;

      const imageDeleted = await deleteImageFromStorage(imagePath);
      if (!imageDeleted) {
        console.warn(`Failed to delete banner image: ${imagePath}`);
      }
    }

    res.json({
      success: true,
      message: "Vendor deleted successfully",
      deletedVendor: existingVendor,
      affected_events_count: associatedEvents ? associatedEvents.length : 0,
    });
  } catch (error) {
    console.error("Delete vendor error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get vendor statistics
controller.getVendorStatistics = async (req, res) => {
  try {
    // Get total vendors count
    const { count: totalVendors, error: countError } = await supabase
      .from("vendor")
      .select("*", { count: "exact", head: true });

    if (countError) {
      throw countError;
    }

    // Get vendors with events count
    const { data: vendorsWithEvents, error: eventsError } = await supabase.from(
      "vendor"
    ).select(`
        id,
        name,
        event:vendor_id (count)
      `);

    if (eventsError) {
      throw eventsError;
    }

    const processedVendors = vendorsWithEvents.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      events_count: vendor.event[0]?.count || 0,
    }));

    const vendorsWithEvents_count = processedVendors.filter(
      (v) => v.events_count > 0
    ).length;
    const vendorsWithoutEvents = processedVendors.filter(
      (v) => v.events_count === 0
    ).length;
    const topVendors = processedVendors
      .sort((a, b) => b.events_count - a.events_count)
      .slice(0, 5);

    res.json({
      success: true,
      total_vendors: totalVendors,
      vendors_with_events: vendorsWithEvents_count,
      vendors_without_events: vendorsWithoutEvents,
      top_vendors_by_events: topVendors,
      total_events: processedVendors.reduce(
        (sum, vendor) => sum + vendor.events_count,
        0
      ),
    });
  } catch (error) {
    console.error("Get vendor statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { controller, upload };
