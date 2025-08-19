// controllers/event_controller.js
const supabase = require("../db/supabase");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const controller = {};

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image or PDF (for permit)
    if (file.fieldname === "banner_image") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Banner must be an image file!"), false);
      }
    } else if (file.fieldname === "permit_img") {
      if (
        file.mimetype.startsWith("image/") ||
        file.mimetype === "application/pdf"
      ) {
        cb(null, true);
      } else {
        cb(new Error("Permit must be an image or PDF file!"), false);
      }
    } else {
      cb(new Error("Unknown file field!"), false);
    }
  },
});

// Helper function to upload file to Supabase Storage
const uploadFileToStorage = async (file, folder = "events") => {
  try {
    // Generate unique filename
    const fileExt = file.originalname.split(".").pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("events") // Create this bucket in Supabase
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
    } = supabase.storage.from("events").getPublicUrl(filePath);

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

// Helper function to delete file from storage
const deleteFileFromStorage = async (filePath) => {
  try {
    const { error } = await supabase.storage.from("events").remove([filePath]);

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

// Helper function to validate date
const validateDates = (start_date, end_date) => {
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  const currentDate = new Date();

  // Check if dates are valid
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { valid: false, message: "Invalid date format" };
  }

  // Check if start date is not in the past
  if (startDate < currentDate.setHours(0, 0, 0, 0)) {
    return { valid: false, message: "Start date cannot be in the past" };
  }

  // Check if end date is after start date
  if (endDate < startDate) {
    return { valid: false, message: "End date must be after start date" };
  }

  return { valid: true };
};

// Helper function to validate phone/contact
const validateContact = (contact) => {
  // Phone number or email validation
  const phoneRegex = /^(\+62|62|0)[0-9]{9,13}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return phoneRegex.test(contact) || emailRegex.test(contact);
};

// CREATE - Add new event
controller.createEvent = async (req, res) => {
  try {
    console.log("=== CREATE EVENT DEBUG START ===");
    console.log("Request method:", req.method);
    console.log("Request headers:", req.headers);
    console.log("Content-Type:", req.get("Content-Type"));

    const {
      name,
      price,
      description,
      category,
      event_category_id,
      location,
      contact,
      start_date,
      end_date,
      area_id,
      vendor_id,
      booth_slot = 10, // Default booth slot
    } = req.body;

    console.log("=== REQUEST BODY ANALYSIS ===");
    console.log("Full req.body:", req.body);
    console.log("req.body type:", typeof req.body);
    console.log("req.body keys:", Object.keys(req.body));

    console.log("=== EXTRACTED FIELDS ===");
    console.log("name:", name, "| type:", typeof name);
    console.log("price:", price, "| type:", typeof price);
    console.log("description:", description, "| type:", typeof description);
    console.log("category:", category, "| type:", typeof category);
    console.log(
      "event_category_id:",
      event_category_id,
      "| type:",
      typeof event_category_id
    );
    console.log("location:", location, "| type:", typeof location);
    console.log("contact:", contact, "| type:", typeof contact);
    console.log("start_date:", start_date, "| type:", typeof start_date);
    console.log("end_date:", end_date, "| type:", typeof end_date);
    console.log("area_id:", area_id, "| type:", typeof area_id);
    console.log("booth_slot", booth_slot, "| type:", typeof booth_slot);
    console.log("vendor_id:", vendor_id, "| type:", typeof vendor_id);

    console.log("=== FILES DEBUG ===");
    console.log("req.files:", req.files);
    console.log("req.files type:", typeof req.files);
    if (req.files) {
      console.log("req.files keys:", Object.keys(req.files));
      console.log("banner_image exists:", !!req.files.banner_image);
      console.log("permit_img exists:", !!req.files.permit_img);
      if (req.files.banner_image) {
        console.log("banner_image details:", req.files.banner_image);
      }
      if (req.files.permit_img) {
        console.log("permit_img details:", req.files.permit_img);
      }
    }

    const files = req.files;

    // Validate required fields
    console.log("=== FIELD VALIDATION ===");
    const requiredFields = {
      name: !!name,
      price: !!price,
      description: !!description,
      category: !!category,
      event_category_id: !!event_category_id,
      location: !!location,
      booth_slot: !!booth_slot,
      contact: !!contact,
      start_date: !!start_date,
      end_date: !!end_date,
    };

    console.log("Required fields validation:", requiredFields);

    const missingFields = Object.keys(requiredFields).filter(
      (field) => !requiredFields[field]
    );
    console.log("Missing fields:", missingFields);

    if (missingFields.length > 0) {
      console.log(
        "❌ VALIDATION FAILED - Missing required fields:",
        missingFields
      );
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
        debug: {
          received_fields: Object.keys(req.body),
          missing_fields: missingFields,
          field_values: requiredFields,
        },
      });
    }

    // Validate price
    console.log("=== PRICE VALIDATION ===");
    const numericPrice = parseInt(price);
    console.log("price string:", price);
    console.log("price numeric:", numericPrice);
    console.log("price is valid number:", !isNaN(numericPrice));

    if (isNaN(numericPrice) || numericPrice < 0) {
      console.log("❌ PRICE VALIDATION FAILED");
      return res.status(400).json({
        success: false,
        message: "Price must be a valid positive number",
        debug: {
          received_price: price,
          parsed_price: numericPrice,
          is_valid: !isNaN(numericPrice) && numericPrice >= 0,
        },
      });
    }

    // Validate dates
    console.log("=== DATE VALIDATION ===");
    console.log("start_date:", start_date);
    console.log("end_date:", end_date);

    const dateValidation = validateDates(start_date, end_date);
    console.log("Date validation result:", dateValidation);

    if (!dateValidation.valid) {
      console.log("❌ DATE VALIDATION FAILED");
      return res.status(400).json({
        success: false,
        message: dateValidation.message,
        debug: {
          start_date,
          end_date,
          validation_result: dateValidation,
        },
      });
    }

    // Validate contact
    console.log("=== CONTACT VALIDATION ===");
    const contactValid = validateContact(contact);
    console.log("Contact validation result:", contactValid);

    if (!contactValid) {
      console.log("❌ CONTACT VALIDATION FAILED");
      return res.status(400).json({
        success: false,
        message: "Contact must be a valid phone number or email",
        debug: {
          received_contact: contact,
          is_valid: contactValid,
        },
      });
    }

    // Check if files are provided
    console.log("=== FILE VALIDATION ===");
    const hasFiles = !!(files && files.banner_image && files.permit_img);
    console.log("Has required files:", hasFiles);

    if (!hasFiles) {
      console.log("❌ FILE VALIDATION FAILED");
      return res.status(400).json({
        success: false,
        message: "Banner image and permit document are required",
        debug: {
          files_received: !!files,
          banner_image_received: !!(files && files.banner_image),
          permit_img_received: !!(files && files.permit_img),
          files_structure: files ? Object.keys(files) : null,
        },
      });
    }

    // Check if event category exists
    console.log("=== EVENT CATEGORY VALIDATION ===");
    console.log("Checking event_category_id:", event_category_id);

    const { data: eventCategory, error: categoryError } = await supabase
      .from("event_category")
      .select("id, name")
      .eq("id", event_category_id)
      .single();

    console.log("Event category query result:", {
      data: eventCategory,
      error: categoryError,
    });

    if (categoryError || !eventCategory) {
      console.log("❌ EVENT CATEGORY VALIDATION FAILED");
      return res.status(400).json({
        success: false,
        message: "Event category not found",
        debug: {
          requested_category_id: event_category_id,
          category_error: categoryError,
          category_found: !!eventCategory,
        },
      });
    }

    // Check if area exists (if provided)
    if (area_id) {
      console.log("=== AREA VALIDATION ===");
      console.log("Checking area_id:", area_id);

      const { data: area, error: areaError } = await supabase
        .from("area")
        .select("id, name")
        .eq("id", area_id)
        .single();

      console.log("Area query result:", { data: area, error: areaError });

      if (areaError || !area) {
        console.log("❌ AREA VALIDATION FAILED");
        return res.status(400).json({
          success: false,
          message: "Area not found",
          debug: {
            requested_area_id: area_id,
            area_error: areaError,
            area_found: !!area,
          },
        });
      }
    }

    // Check if vendor exists (if provided)
    if (vendor_id) {
      console.log("=== VENDOR VALIDATION ===");
      console.log("Checking vendor_id:", vendor_id);

      const { data: vendor, error: vendorError } = await supabase
        .from("vendor")
        .select("id, name")
        .eq("id", vendor_id)
        .single();

      console.log("Vendor query result:", { data: vendor, error: vendorError });

      if (vendorError || !vendor) {
        console.log("❌ VENDOR VALIDATION FAILED");
        return res.status(400).json({
          success: false,
          message: "Vendor not found",
          debug: {
            requested_vendor_id: vendor_id,
            vendor_error: vendorError,
            vendor_found: !!vendor,
          },
        });
      }
    }

    console.log("=== FILE UPLOAD START ===");

    // Upload banner image
    console.log("Uploading banner image...");
    const bannerUpload = await uploadFileToStorage(
      files.banner_image[0],
      "events/banners"
    );
    console.log("Banner upload result:", bannerUpload);

    if (!bannerUpload.success) {
      console.log("❌ BANNER UPLOAD FAILED");
      return res.status(500).json({
        success: false,
        message: "Failed to upload banner image",
        error: bannerUpload.error,
      });
    }

    // Upload permit document
    console.log("Uploading permit document...");
    const permitUpload = await uploadFileToStorage(
      files.permit_img[0],
      "events/permits"
    );
    console.log("Permit upload result:", permitUpload);

    if (!permitUpload.success) {
      console.log("❌ PERMIT UPLOAD FAILED");
      // Delete banner if permit upload fails
      await deleteFileFromStorage(bannerUpload.filePath);
      return res.status(500).json({
        success: false,
        message: "Failed to upload permit document",
        error: permitUpload.error,
      });
    }

    console.log("=== DATABASE INSERT START ===");

    const insertData = {
      name: name.trim(),
      price: parseInt(price),
      description: description.trim(),
      category: category.trim(),
      event_category_id: parseInt(event_category_id),
      location: location.trim(),
      booth_slot: parseInt(booth_slot),
      contact: contact.trim(),
      start_date,
      end_date,
      banner: bannerUpload.publicUrl,
      permit_img: permitUpload.publicUrl,
      area_id: area_id ? parseInt(area_id) : null,
      vendor_id: vendor_id || null,
    };

    console.log("Data to insert:", insertData);

    // Insert new event
    const { data, error } = await supabase
      .from("event")
      .insert(insertData)
      .select(
        `
        *,
        event_category:event_category_id (id, name),
        area:area_id (id, name),
        vendor:vendor_id (id, name)
      `
      )
      .single();

    console.log("Database insert result:", { data, error });

    if (error) {
      console.log("❌ DATABASE INSERT FAILED");
      // Delete uploaded files if database insert fails
      await deleteFileFromStorage(bannerUpload.filePath);
      await deleteFileFromStorage(permitUpload.filePath);
      console.error("Create event error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create event",
        error: error.message,
        debug: {
          insert_data: insertData,
          database_error: error,
        },
      });
    }

    console.log("✅ EVENT CREATED SUCCESSFULLY");
    console.log("=== CREATE EVENT DEBUG END ===");

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: {
        ...data,
        uploaded_files: {
          banner_path: bannerUpload.filePath,
          permit_path: permitUpload.filePath,
        },
      },
    });
  } catch (error) {
    console.error("❌ UNEXPECTED ERROR:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
      debug: {
        error_type: error.constructor.name,
        error_stack: error.stack,
      },
    });
  }
};

// READ - Get all events
controller.getAllEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      event_category_id,
      area_id,
      vendor_id,
      min_price,
      max_price,
      start_date,
      end_date,
      sort_by = "start_date",
      sort_order = "desc",
    } = req.query;

    const offset = (page - 1) * limit;

    // Validate sort parameters
    const allowedSortBy = ["id", "name", "price", "start_date", "end_date"];
    const allowedSortOrder = ["asc", "desc"];
    const sortBy = allowedSortBy.includes(sort_by) ? sort_by : "start_date";
    const sortOrder = allowedSortOrder.includes(sort_order)
      ? sort_order
      : "desc";

    // Get events with related data including booths
    let query = supabase
      .from("event")
      .select(
        `
        *,
        event_category:event_category_id (id, name),
        area:area_id (id, name),
        vendor:vendor_id (id, name),
        booth!booth_event_id_fkey (
          id,
          name,
          phone,
          desc,
          is_acc
        ),
        rating!rating_event_id_fkey (
          id,
          name,
          review,
          rating_star
        )
      `,
        { count: "exact" }
      )
      .order(sortBy, { ascending: sortOrder === "asc" });
    // .range(offset, offset + limit - 1);

    // Add filters
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`
      );
    }
    if (category) {
      query = query.ilike("category", `%${category}%`);
    }
    if (event_category_id) {
      query = query.eq("event_category_id", event_category_id);
    }
    if (area_id) {
      query = query.eq("area_id", area_id);
    }
    if (vendor_id) {
      query = query.eq("vendor_id", vendor_id);
    }
    if (min_price) {
      query = query.gte("price", parseInt(min_price));
    }
    if (max_price) {
      query = query.lte("price", parseInt(max_price));
    }
    if (start_date) {
      query = query.gte("start_date", start_date);
    }
    if (end_date) {
      query = query.lte("end_date", end_date);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get events error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch events",
        error: error.message,
      });
    }

    // Process data to add booth statistics and other calculated fields
    const processedData = data.map((event) => {
      const booths = event.booth || [];
      const ratings = event.rating || [];

      // Calculate rating statistics
      const rating_count = ratings.length;
      const average_rating = rating_count
        ? parseFloat(
            (
              ratings.reduce(
                (acc, r) =>
                  acc +
                  (typeof r.rating_star === "number"
                    ? r.rating_star
                    : parseInt(r.rating_star) || 0),
                0
              ) / rating_count
            ).toFixed(2)
          )
        : 0;

      // Calculate booth statistics
      const boothStats = {
        total: booths.length,
        pending: booths.filter((b) => b.is_acc === "PENDING").length,
        approved: booths.filter((b) => b.is_acc === "APPROVED").length,
        rejected: booths.filter((b) => b.is_acc === "REJECTED").length,
      };

      return {
        ...event,
        booth: {
          count: booths.length,
          statistics: boothStats,
          applications: booths, // All booth applications
        },
        booth_count: booths.length, // Keep for backward compatibility
        average_rating,
        rating_count,
        duration_days:
          Math.ceil(
            (new Date(event.end_date) - new Date(event.start_date)) /
              (1000 * 60 * 60 * 24)
          ) + 1,
        status:
          new Date(event.end_date) < new Date()
            ? "completed"
            : new Date(event.start_date) <= new Date()
            ? "ongoing"
            : "upcoming",
      };
    });

    res.json({
      success: true,
      data: processedData,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
      filters: {
        search,
        category,
        event_category_id,
        area_id,
        vendor_id,
        price_range: { min_price, max_price },
        date_range: { start_date, end_date },
      },
    });
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get event data for dropdowns
controller.getEventData = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      event_category_id,
      area_id,
      vendor_id,
      min_price,
      max_price,
      start_date,
      end_date,
      sort_by = "start_date",
      sort_order = "asc",
    } = req.query;

    const offset = (page - 1) * limit;

    // Validate sort parameters
    const allowedSortBy = [
      "id",
      "name",
      "price",
      "start_date",
      "end_date",
      "created_at",
    ];
    const allowedSortOrder = ["asc", "desc"];
    const sortBy = allowedSortBy.includes(sort_by) ? sort_by : "start_date";
    const sortOrder = allowedSortOrder.includes(sort_order)
      ? sort_order
      : "asc";

    // Get events data only
    let query = supabase
      .from("event")
      .select("*", { count: "exact" })
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + parseInt(limit) - 1);

    // Add filters
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`
      );
    }

    if (event_category_id) {
      query = query.eq("event_category_id", event_category_id);
    }

    if (area_id) {
      query = query.eq("area_id", area_id);
    }

    if (vendor_id) {
      query = query.eq("vendor_id", vendor_id);
    }

    if (min_price) {
      query = query.gte("price", parseInt(min_price));
    }

    if (max_price) {
      query = query.lte("price", parseInt(max_price));
    }

    if (start_date) {
      query = query.gte("start_date", start_date);
    }

    if (end_date) {
      query = query.lte("end_date", end_date);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get event data error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch event data",
        error: error.message,
      });
    }

    // Add some basic calculated fields if needed
    const processedData = data.map((event) => ({
      ...event,
      duration_days:
        event.start_date && event.end_date
          ? Math.ceil(
              (new Date(event.end_date) - new Date(event.start_date)) /
                (1000 * 60 * 60 * 24)
            ) + 1
          : null,
      status:
        event.start_date && event.end_date
          ? new Date(event.end_date) < new Date()
            ? "completed"
            : new Date(event.start_date) <= new Date()
            ? "ongoing"
            : "upcoming"
          : "unknown",
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
      filters: {
        search,
        event_category_id,
        area_id,
        vendor_id,
        price_range: { min_price, max_price },
        date_range: { start_date, end_date },
        sort_by: sortBy,
        sort_order: sortOrder,
      },
    });
  } catch (error) {
    console.error("Get event data error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all events User
controller.getAllEventsUser = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      event_category_id,
      area_id,
      vendor_id,
      min_price,
      max_price,
      start_date,
      end_date,
      sort_by = "start_date",
      sort_order = "asc",
    } = req.query;

    const offset = (page - 1) * limit;

    // Validate sort parameters
    const allowedSortBy = ["id", "name", "price", "start_date", "end_date"];
    const allowedSortOrder = ["asc", "desc"];
    const sortBy = allowedSortBy.includes(sort_by) ? sort_by : "start_date";
    const sortOrder = allowedSortOrder.includes(sort_order)
      ? sort_order
      : "asc";

    // Get events with related data including booths
    let query = supabase
      .from("event")
      .select(
        `
        *,
        event_category:event_category_id (id, name),
        area:area_id (id, name),
        vendor:vendor_id (id, name),
        booth!booth_event_id_fkey (
          id,
          name,
          phone,
          desc,
          is_acc
        ),
        rating!rating_event_id_fkey (
          id,
          name,
          review,
          rating_star
        )
      `,
        { count: "exact" }
      )
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    // Add filters
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`
      );
    }
    if (category) {
      query = query.ilike("category", `%${category}%`);
    }
    if (event_category_id) {
      query = query.eq("event_category_id", event_category_id);
    }
    if (area_id) {
      query = query.eq("area_id", area_id);
    }
    if (vendor_id) {
      query = query.eq("vendor_id", vendor_id);
    }
    if (min_price) {
      query = query.gte("price", parseInt(min_price));
    }
    if (max_price) {
      query = query.lte("price", parseInt(max_price));
    }
    if (start_date) {
      query = query.gte("start_date", start_date);
    }
    if (end_date) {
      query = query.lte("end_date", end_date);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get events error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch events",
        error: error.message,
      });
    }

    // Process data to add booth statistics and other calculated fields
    const processedData = data.map((event) => {
      const booths = event.booth || [];
      const ratings = event.rating || [];

      // Calculate rating statistics
      const rating_count = ratings.length;
      const average_rating = rating_count
        ? parseFloat(
            (
              ratings.reduce(
                (acc, r) =>
                  acc +
                  (typeof r.rating_star === "number"
                    ? r.rating_star
                    : parseInt(r.rating_star) || 0),
                0
              ) / rating_count
            ).toFixed(2)
          )
        : 0;

      // Calculate booth statistics
      const boothStats = {
        total: booths.length,
        pending: booths.filter((b) => b.is_acc === "PENDING").length,
        approved: booths.filter((b) => b.is_acc === "APPROVED").length,
        rejected: booths.filter((b) => b.is_acc === "REJECTED").length,
      };

      return {
        ...event,
        booth: {
          count: booths.length,
          statistics: boothStats,
          applications: booths, // All booth applications
        },
        booth_count: booths.length, // Keep for backward compatibility
        average_rating,
        rating_count,
        duration_days:
          Math.ceil(
            (new Date(event.end_date) - new Date(event.start_date)) /
              (1000 * 60 * 60 * 24)
          ) + 1,
        status:
          new Date(event.end_date) < new Date()
            ? "completed"
            : new Date(event.start_date) <= new Date()
            ? "ongoing"
            : "upcoming",
      };
    });

    res.json({
      success: true,
      data: processedData,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
      filters: {
        search,
        category,
        event_category_id,
        area_id,
        vendor_id,
        price_range: { min_price, max_price },
        date_range: { start_date, end_date },
      },
    });
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get event by ID
controller.getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid event ID is required",
      });
    }

    // Correct the booth select statement to reference the foreign key constraint
    const { data, error } = await supabase
      .from("event")
      .select(
        `
                *,
                event_category:event_category_id (id, name),
                area:area_id (id, name),
                vendor:vendor_id (id, name, phone, insta),
                booth!booth_event_id_fkey (
                    id,
                    name,
                    phone,
                    desc,
                    is_acc
                )
                `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Add calculated fields
    const eventData = {
      ...data,
      booth_count: data.booth ? data.booth.length : 0,
      // Assuming your is_acc values are 'ACCEPT', 'PENDING', 'REJECT'
      accepted_booths: data.booth
        ? data.booth.filter((b) => b.is_acc === "ACCEPT").length
        : 0,
      pending_booths: data.booth
        ? data.booth.filter((b) => b.is_acc === "PENDING").length
        : 0,
      rejected_booths: data.booth
        ? data.booth.filter((b) => b.is_acc === "REJECT").length
        : 0,
      duration_days:
        Math.ceil(
          (new Date(data.end_date) - new Date(data.start_date)) /
            (1000 * 60 * 60 * 24)
        ) + 1,
      status:
        new Date(data.end_date) < new Date()
          ? "completed"
          : new Date(data.start_date) <= new Date()
          ? "ongoing"
          : "upcoming",
      days_until_start: Math.ceil(
        (new Date(data.start_date) - new Date()) / (1000 * 60 * 60 * 24)
      ),
      days_until_end: Math.ceil(
        (new Date(data.end_date) - new Date()) / (1000 * 60 * 60 * 24)
      ),
      is_registration_open: new Date(data.start_date) > new Date(),
      formatted_dates: {
        start_date: new Date(data.start_date).toLocaleDateString("id-ID"),
        end_date: new Date(data.end_date).toLocaleDateString("id-ID"),
        start_date_full: new Date(data.start_date).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        end_date_full: new Date(data.end_date).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      },
    };

    res.json({
      success: true,
      data: eventData,
    });
  } catch (error) {
    console.error("Get event by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get events by vendor ID
controller.getEventsByVendorId = async (req, res) => {
  try {
    const { vendor_id } = req.params;
    const {
      status = "all", // all, upcoming, ongoing, completed
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabase
      .from("event")
      .select(
        `
        *,
        event_category:event_category_id (id, name),
        area:area_id (id, name),
        event_id (count)
      `,
        { count: "exact" }
      )
      .eq("vendor_id", vendor_id)
      .order("start_date", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Get events by vendor error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch vendor events",
        error: error.message,
      });
    }

    // Filter by status if specified
    let filteredData = data;
    if (status !== "all") {
      const currentDate = new Date();
      filteredData = data.filter((event) => {
        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date);

        switch (status) {
          case "upcoming":
            return startDate > currentDate;
          case "ongoing":
            return startDate <= currentDate && endDate >= currentDate;
          case "completed":
            return endDate < currentDate;
          default:
            return true;
        }
      });
    }

    // Process data
    const processedData = filteredData.map((event) => ({
      ...event,
      booth_count: event.booth[0]?.count || 0,
      duration_days:
        Math.ceil(
          (new Date(event.end_date) - new Date(event.start_date)) /
            (1000 * 60 * 60 * 24)
        ) + 1,
      status:
        new Date(event.end_date) < new Date()
          ? "completed"
          : new Date(event.start_date) <= new Date()
          ? "ongoing"
          : "upcoming",
    }));

    res.json({
      success: true,
      data: processedData, // Added missing 'data' property
      pagination: {
        total: count,
        filtered_total: filteredData.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
        has_next_page: parseInt(page) < Math.ceil(count / limit),
        has_prev_page: parseInt(page) > 1,
      },
      vendor_id,
      status_filter: status,
    });
  } catch (error) {
    console.error("Get events by vendor error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update event
controller.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      price,
      description,
      category,
      event_category_id,
      location,
      booth_slot = 10, // Default booth slot
      contact,
      start_date,
      end_date,
      area_id,
      vendor_id,
      remove_banner, // New field
      remove_permit, // New field
    } = req.body;

    const files = req.files;

    if (remove_banner === "true") {
      updateData.banner = null;
      // Delete old banner file
      if (existingEvent.banner) {
        const urlParts = existingEvent.banner.split("/");
        const fileName = urlParts[urlParts.length - 1];
        await deleteFileFromStorage(`events/banners/${fileName}`);
      }
    }

    if (remove_permit === "true") {
      updateData.permit_img = null;
      // Delete old permit file
      if (existingEvent.permit_img) {
        const urlParts = existingEvent.permit_img.split("/");
        const fileName = urlParts[urlParts.length - 1];
        await deleteFileFromStorage(`events/permits/${fileName}`);
      }
    }

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid event ID is required",
      });
    }

    // Check if event exists
    const { data: existingEvent, error: fetchError } = await supabase
      .from("event")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Check if event can still be updated (not past events)
    // if (new Date(existingEvent.start_date) < new Date()) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Cannot update past or ongoing events",
    //   });
    // }

    // Prepare update data
    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (category !== undefined) updateData.category = category.trim();
    if (location !== undefined) updateData.location = location.trim();
    if (booth_slot !== undefined) updateData.booth_slot = parseInt(booth_slot);

    if (price !== undefined) {
      if (price < 0) {
        return res.status(400).json({
          success: false,
          message: "Price cannot be negative",
        });
      }
      updateData.price = parseInt(price);
    }

    if (contact !== undefined) {
      if (!validateContact(contact)) {
        return res.status(400).json({
          success: false,
          message: "Contact must be a valid phone number or email",
        });
      }
      updateData.contact = contact.trim();
    }

    // Validate dates if provided
    if (start_date !== undefined || end_date !== undefined) {
      const newStartDate = start_date || existingEvent.start_date;
      const newEndDate = end_date || existingEvent.end_date;

      const dateValidation = validateDates(newStartDate, newEndDate);
      if (!dateValidation.valid) {
        return res.status(400).json({
          success: false,
          message: dateValidation.message,
        });
      }

      if (start_date !== undefined) updateData.start_date = start_date;
      if (end_date !== undefined) updateData.end_date = end_date;
    }

    // Validate foreign keys if provided
    if (event_category_id !== undefined) {
      const { data: eventCategory, error: categoryError } = await supabase
        .from("event_category")
        .select("id")
        .eq("id", event_category_id)
        .single();

      if (categoryError || !eventCategory) {
        return res.status(400).json({
          success: false,
          message: "Event category not found",
        });
      }
      updateData.event_category_id = parseInt(event_category_id);
    }

    if (area_id !== undefined) {
      if (area_id) {
        const { data: area, error: areaError } = await supabase
          .from("area")
          .select("id")
          .eq("id", area_id)
          .single();

        if (areaError || !area) {
          return res.status(400).json({
            success: false,
            message: "Area not found",
          });
        }
        updateData.area_id = parseInt(area_id);
      } else {
        updateData.area_id = null;
      }
    }

    if (vendor_id !== undefined) {
      if (vendor_id) {
        const { data: vendor, error: vendorError } = await supabase
          .from("vendor")
          .select("id")
          .eq("id", vendor_id)
          .single();

        if (vendorError || !vendor) {
          return res.status(400).json({
            success: false,
            message: "Vendor not found",
          });
        }
        updateData.vendor_id = vendor_id;
      } else {
        updateData.vendor_id = null;
      }
    }

    // Handle file uploads
    let oldBannerPath = null;
    let oldPermitPath = null;
    let newBannerUrl = null;
    let newPermitUrl = null;

    // Handle banner image upload
    if (files && files.banner_image) {
      const bannerUpload = await uploadFileToStorage(
        files.banner_image[0],
        "events/banners"
      );
      if (!bannerUpload.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload new banner image",
          error: bannerUpload.error,
        });
      }

      updateData.banner = bannerUpload.publicUrl;
      newBannerUrl = bannerUpload.publicUrl;

      // Extract old banner path for deletion
      if (existingEvent.banner) {
        const urlParts = existingEvent.banner.split("/");
        const fileName = urlParts[urlParts.length - 1];
        oldBannerPath = `events/banners/${fileName}`;
      }
    }

    // Handle permit document upload
    if (files && files.permit_img) {
      const permitUpload = await uploadFileToStorage(
        files.permit_img[0],
        "events/permits"
      );
      if (!permitUpload.success) {
        // Delete new banner if permit upload fails
        if (newBannerUrl) {
          const urlParts = newBannerUrl.split("/");
          const fileName = urlParts[urlParts.length - 1];
          await deleteFileFromStorage(`events/banners/${fileName}`);
        }

        return res.status(500).json({
          success: false,
          message: "Failed to upload new permit document",
          error: permitUpload.error,
        });
      }

      updateData.permit_img = permitUpload.publicUrl;
      newPermitUrl = permitUpload.publicUrl;

      // Extract old permit path for deletion
      if (existingEvent.permit_img) {
        const urlParts = existingEvent.permit_img.split("/");
        const fileName = urlParts[urlParts.length - 1];
        oldPermitPath = `events/permits/${fileName}`;
      }
    }

    // Validate at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    // Update event
    const { data, error } = await supabase
      .from("event")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        event_category:event_category_id (id, name),
        area:area_id (id, name),
        vendor:vendor_id (id, name)
      `
      )
      .single();

    if (error) {
      // If update fails and new files were uploaded, delete them
      if (newBannerUrl) {
        const urlParts = newBannerUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        await deleteFileFromStorage(`events/banners/${fileName}`);
      }
      if (newPermitUrl) {
        const urlParts = newPermitUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        await deleteFileFromStorage(`events/permits/${fileName}`);
      }

      console.error("Update event error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update event",
        error: error.message,
      });
    }

    // Delete old files if new ones were uploaded successfully
    if (oldBannerPath && newBannerUrl) {
      await deleteFileFromStorage(oldBannerPath);
    }
    if (oldPermitPath && newPermitUrl) {
      await deleteFileFromStorage(oldPermitPath);
    }

    res.json({
      success: true,
      message: "Event updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE - Delete event
controller.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.query;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid event ID is required",
      });
    }

    // Check if event exists
    const { data: existingEvent, error: fetchError } = await supabase
      .from("event")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Check if event has associated booths
    const { data: associatedBooths, error: boothsError } = await supabase
      .from("booth")
      .select("id, name, is_acc")
      .eq("event_id", id)
      .limit(5);

    if (boothsError) {
      console.error("Check associated booths error:", boothsError);
      return res.status(500).json({
        success: false,
        message: "Failed to check associated booths",
        error: boothsError.message,
      });
    }

    // If has associated booths and not force delete, return error
    if (associatedBooths && associatedBooths.length > 0 && force !== "true") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete event with associated booth applications",
        associated_booths_count: associatedBooths.length,
        sample_booths: associatedBooths,
        suggestion:
          "Use ?force=true to delete anyway (this will affect associated booths)",
      });
    }

    // Delete event from database
    const { error: deleteError } = await supabase
      .from("event")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete event error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete event",
        error: deleteError.message,
      });
    }

    // Delete associated files from storage
    if (existingEvent.banner) {
      const urlParts = existingEvent.banner.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const bannerPath = `events/banners/${fileName}`;

      const bannerDeleted = await deleteFileFromStorage(bannerPath);
      if (!bannerDeleted) {
        console.warn(`Failed to delete banner: ${bannerPath}`);
      }
    }

    if (existingEvent.permit_img) {
      const urlParts = existingEvent.permit_img.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const permitPath = `events/permits/${fileName}`;

      const permitDeleted = await deleteFileFromStorage(permitPath);
      if (!permitDeleted) {
        console.warn(`Failed to delete permit: ${permitPath}`);
      }
    }

    res.json({
      success: true,
      message: "Event deleted successfully",
      edEvent: existingEvent,
      affected_booths_count: associatedBooths ? associatedBooths.length : 0,
    });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get event statistics
controller.getEventStatistics = async (req, res) => {
  try {
    const { start_date, end_date, event_category_id, area_id, vendor_id } =
      req.query;

    let query = supabase.from("event").select(`
      id,
      price,
      start_date,
      end_date,
      event_category_id,
      area_id,
      vendor_id
    `); // Removed trailing comma

    // Apply filters
    if (start_date) {
      query = query.gte("start_date", start_date);
    }
    if (end_date) {
      query = query.lte("end_date", end_date);
    }
    if (event_category_id) {
      query = query.eq("event_category_id", event_category_id);
    }
    if (area_id) {
      query = query.eq("area_id", area_id);
    }
    if (vendor_id) {
      query = query.eq("vendor_id", vendor_id);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Get booth counts separately since you're not selecting booth data
    const eventIds = data.map((event) => event.id);
    let boothCounts = {};

    if (eventIds.length > 0) {
      const { data: boothData, error: boothError } = await supabase
        .from("booth")
        .select("event_id, is_acc")
        .in("event_id", eventIds);

      if (!boothError && boothData) {
        boothCounts = boothData.reduce((acc, booth) => {
          if (!acc[booth.event_id]) {
            acc[booth.event_id] = 0;
          }
          acc[booth.event_id]++;
          return acc;
        }, {});
      }
    }

    // Calculate statistics
    const currentDate = new Date();
    const upcomingEvents = data.filter(
      (event) => new Date(event.start_date) > currentDate
    );
    const ongoingEvents = data.filter(
      (event) =>
        new Date(event.start_date) <= currentDate &&
        new Date(event.end_date) >= currentDate
    );
    const completedEvents = data.filter(
      (event) => new Date(event.end_date) < currentDate
    );

    const stats = {
      total_events: data.length,
      upcoming_events: upcomingEvents.length,
      ongoing_events: ongoingEvents.length,
      completed_events: completedEvents.length,
      total_booths: data.reduce(
        (sum, event) => sum + (boothCounts[event.id] || 0), // Fixed: use boothCounts instead of event.booth
        0
      ),
      price_stats: {
        min_price: data.length > 0 ? Math.min(...data.map((e) => e.price)) : 0,
        max_price: data.length > 0 ? Math.max(...data.map((e) => e.price)) : 0,
        avg_price:
          data.length > 0
            ? Math.round(
                data.reduce((sum, e) => sum + e.price, 0) / data.length
              )
            : 0,
      },
      revenue_projection: upcomingEvents.reduce(
        (sum, event) => sum + event.price * (boothCounts[event.id] || 0), // Fixed: use boothCounts
        0
      ),
    };

    res.json({
      success: true,
      data: stats,
      filters: {
        start_date,
        end_date,
        event_category_id,
        area_id,
        vendor_id,
      },
    });
  } catch (error) {
    console.error("Get event statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { controller, upload };
