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
    console.log("=== MULTER FILE FILTER ===");
    console.log("File received in filter:", file);

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
    console.log("=== MULTER DEBUG ===");
    console.log("req.file:", req.file);
    console.log("req.files:", req.files);
    console.log("req.body:", req.body);
    console.log("Content-Type:", req.headers["content-type"]);

    const { name, user_id, desc, phone, insta, location, email } = req.body;
    const file = req.file;

    // Validate required fields
    if (!name || !user_id || !desc || !phone || !insta || !email) {
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

    // Ensure the user doesn't already have a vendor profile
    const { count: existingVendorCount, error: existingVendorCheckError } =
      await supabase
        .from("vendor")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user_id);

    if (existingVendorCheckError) {
      console.error(
        "Error checking existing vendor for user:",
        existingVendorCheckError
      );
      return res.status(500).json({
        success: false,
        message: "Failed to validate existing vendor",
        error: existingVendorCheckError.message,
      });
    }

    if ((existingVendorCount ?? 0) > 0) {
      return res.status(409).json({
        success: false,
        message: "Vendor for this user already exists",
      });
    }

    if (file) {
      console.log("File received:", file.originalname);
      console.log("File size:", file.size);
      console.log("File mimetype:", file.mimetype);
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

    console.log("=== FILE VALIDATION ===");
    const hasFiles = !!file; // Changed from files check
    console.log("Has required files:", hasFiles);

    if (!hasFiles) {
      console.log("❌ FILE VALIDATION FAILED");
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
        debug: {
          file_received: !!file, // Changed from files check
        },
      });
    }

    // Handle banner - file upload
    let bannerUrl = null;
    let uploadedFilePath = null; // Define this variable
    console.log("Processing file upload...");

    const uploadResult = await uploadImageToStorage(
      file, // Changed from files.banner_image[0]
      "vendors/banners"
    );

    if (!uploadResult.success) {
      console.error("Upload error:", uploadResult.error);
      if (uploadResult.filePath) {
        await deleteImageFromStorage(uploadResult.filePath);
      }
      return res.status(500).json({
        success: false,
        message: "Failed to upload banner image",
        error: uploadResult.error,
      });
    }

    bannerUrl = uploadResult.publicUrl;
    uploadedFilePath = uploadResult.filePath; // Store the file path for cleanup if needed

    // Format Instagram (ensure it's stored consistently)
    let formattedInsta = insta;
    if (insta.includes("instagram.com/")) {
      formattedInsta = insta.split("instagram.com/")[1].replace("/", "");
    } else if (insta.startsWith("@")) {
      formattedInsta = insta.substring(1);
    }

    // Generate UUID for the vendor id
    const vendorId = uuidv4();

    // Prepare insert data
    const insertData = {
      id: vendorId, // Add the generated UUID
      name: name.trim(),
      user_id: user_id,
      desc: desc.trim(),
      phone: parseInt(phone),
      insta: formattedInsta,
      location: location ? location.trim() : null,
      email: email.trim(),
    };

    // Add banner if provided
    if (bannerUrl) {
      insertData.banner = bannerUrl;
    }

    console.log("Insert data:", insertData);

    // Insert new vendor
    const { data, error } = await supabase
      .from("vendor")
      .insert(insertData)
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
      ...data,
      file_path: uploadedFilePath,
      instagram_url: data.insta ? `https://instagram.com/${data.insta}` : null,
    });
  } catch (error) {
    console.error("Create vendor error:", error);

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
      .order(sortBy, { ascending: sortOrder === "asc" });
    // .range(offset, offset + limit - 1);

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

// READ - Get all vendors Users
controller.getAllVendorsUser = async (req, res) => {
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

    console.log("Fetching vendor by ID:", id);

    const { data, error } = await supabase
      .from("vendor")
      .select(
        `
        *,
        user:user_id (id, first_name, last_name, email, role),
        event (
          id,
          name,
          price,
          start_date,
          end_date,
          location,
          category,
          banner
        )
      `
      )
      .eq("id", id)
      .single();

    console.log("Vendor data fetched:", data);
    console.log("Error fetching vendor:", error);

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
    console.log("Fetching vendor by user ID:", user_id);

    const { data, error } = await supabase
      .from("vendor")
      .select(
        `
        id
      `
      )
      .eq("user_id", user_id)
      .single();

    console.log("Vendor data by user ID:", data);
    console.log("Error fetching vendor by user ID:", error);

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
    const {
      name,
      desc,
      phone,
      insta,
      location,
      banner,
      remove_banner,
      user_id,
      email,
    } = req.body;

    const file = req.file;

    console.log("=== UPDATE VENDOR DEBUG ===");
    console.log("Vendor ID:", id);
    console.log("Request body:", req.body);
    console.log("File:", file);
    console.log("Content-Type:", req.headers["content-type"]);

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

    if (name !== undefined && name.toString().trim()) {
      updateData.name = name.toString().trim();
    }

    if (desc !== undefined) {
      updateData.desc = desc.toString().trim();
    }

    if (location !== undefined) {
      const locationStr = location ? location.toString().trim() : null;
      updateData.location = locationStr || null;
    }

    if (email !== undefined) {
      const emailStr = email.toString().trim();
      updateData.email = emailStr || null;
    }

    // Phone validation
    if (phone !== undefined) {
      const phoneStr = phone.toString().trim();
      if (phoneStr) {
        if (!validatePhone(phoneStr)) {
          return res.status(400).json({
            success: false,
            message: "Invalid phone number format",
          });
        }
        updateData.phone = parseInt(phoneStr);
      }
    }

    // Instagram validation
    if (insta !== undefined) {
      const instaStr = insta.toString().trim();
      if (instaStr) {
        if (!validateInstagram(instaStr)) {
          return res.status(400).json({
            success: false,
            message: "Invalid Instagram username or URL",
          });
        }
        let formattedInsta = instaStr;
        if (instaStr.includes("instagram.com/")) {
          formattedInsta = instaStr.split("instagram.com/")[1].replace("/", "");
        } else if (instaStr.startsWith("@")) {
          formattedInsta = instaStr.substring(1);
        }
        updateData.insta = formattedInsta;
      }
    }

    // User ID validation
    if (user_id !== undefined) {
      const userIdStr = user_id.toString().trim();
      if (userIdStr) {
        const { data: userExists, error: userError } = await supabase
          .from("user")
          .select("id, role")
          .eq("id", userIdStr)
          .single();

        if (userError || !userExists) {
          return res.status(400).json({
            success: false,
            message: "User not found",
          });
        }

        const { count: vendorUserCount, error: vendorUserError } =
          await supabase
            .from("vendor")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userIdStr)
            .neq("id", id);

        if (vendorUserError) {
          console.error(
            "Error checking vendor-user uniqueness:",
            vendorUserError
          );
          return res.status(500).json({
            success: false,
            message: "Failed to validate vendor-user uniqueness",
            error: vendorUserError.message,
          });
        }

        if ((vendorUserCount ?? 0) > 0) {
          return res.status(409).json({
            success: false,
            message: "User is already assigned to another vendor",
          });
        }

        updateData.user_id = userIdStr;
      }
    }

    let newImageUrl = null;
    let oldImagePath = null;
    let uploadedFilePath = null;

    // Handle banner updates - FIXED LOGIC
    if (file) {
      // New file is being uploaded
      console.log("Processing new file upload for update...");
      console.log("File details:", {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      const uploadResult = await uploadImageToStorage(file, "vendors/banners");

      if (!uploadResult.success) {
        console.error("Upload failed:", uploadResult.error);
        return res.status(500).json({
          success: false,
          message: "Failed to upload new banner image",
          error: uploadResult.error,
        });
      }

      // Set the new banner URL
      updateData.banner = uploadResult.publicUrl;
      newImageUrl = uploadResult.publicUrl;
      uploadedFilePath = uploadResult.filePath;

      // Mark old image for deletion if it exists
      if (existingVendor.banner) {
        try {
          const urlParts = existingVendor.banner.split("/");
          const fileName = urlParts[urlParts.length - 1];
          oldImagePath = `vendors/banners/${fileName}`;
        } catch (error) {
          console.error("Error parsing old image path:", error);
        }
      }
    } else if (remove_banner === "true" || remove_banner === true) {
      // Only remove banner if no new file is being uploaded
      console.log("Removing banner without replacement...");

      // Check if banner column allows null - if not, require a replacement
      if (!banner || !banner.toString().trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Banner is required. Please provide a banner URL or upload a new image.",
        });
      }

      updateData.banner = banner.toString().trim();

      // Mark old image for deletion
      if (existingVendor.banner) {
        try {
          const urlParts = existingVendor.banner.split("/");
          const fileName = urlParts[urlParts.length - 1];
          oldImagePath = `vendors/banners/${fileName}`;
        } catch (error) {
          console.error("Error parsing old image path:", error);
        }
      }
    } else if (banner !== undefined && banner.toString().trim()) {
      // Banner URL is being updated
      const bannerStr = banner.toString().trim();
      if (bannerStr !== existingVendor.banner) {
        console.log("Updating banner URL...");
        updateData.banner = bannerStr;

        // Mark old image for deletion if it was stored in our storage
        if (
          existingVendor.banner &&
          existingVendor.banner.includes("supabase")
        ) {
          try {
            const urlParts = existingVendor.banner.split("/");
            const fileName = urlParts[urlParts.length - 1];
            oldImagePath = `vendors/banners/${fileName}`;
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

    // Update vendor in database
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
        message: "Failed to update vendor",
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
      message: "Vendor updated successfully",
      ...data,
      instagram_url: data.insta ? `https://instagram.com/${data.insta}` : null,
      file_path: uploadedFilePath,
    });
  } catch (error) {
    console.error("Update vendor error:", error);

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
      const imagePath = `vendors/banners/${fileName}`;

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
