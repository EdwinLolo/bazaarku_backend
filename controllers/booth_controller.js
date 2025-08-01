// controllers/booth_controller.js
const supabase = require("../db/supabase");

const controller = {};

// Helper function to validate phone number
const validatePhone = (phone) => {
  if (!phone) return false;
  const phoneStr = phone.toString();
  return (
    phoneStr.length >= 10 && phoneStr.length <= 15 && /^\d+$/.test(phoneStr)
  );
};

// CREATE - Add new booth application
controller.createBooth = async (req, res) => {
  try {
    const { name, phone, event_id, desc } = req.body;

    // Validate required fields
    if (!name || !phone || !event_id || !desc) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, event_id, and description are required",
      });
    }

    // Validate phone number
    if (!validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format (10-15 digits)",
      });
    }

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from("event")
      .select("id, name, start_date, end_date")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return res.status(400).json({
        success: false,
        message: "Event not found",
      });
    }

    // Check if event is still accepting booth applications (optional check)
    const currentDate = new Date();
    const eventStartDate = new Date(event.start_date);

    if (eventStartDate < currentDate) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply for booth on past events",
      });
    }

    // Check if user already applied for booth in this event (prevent duplicates)
    if (req.user) {
      const { data: existingBooth, error: duplicateError } = await supabase
        .from("booth")
        .select("id, is_acc")
        .eq("event_id", event_id)
        .eq("phone", phone) // Using phone as identifier
        .single();

      if (existingBooth) {
        return res.status(400).json({
          success: false,
          message: "You already have a booth application for this event",
          existing_booth: {
            id: existingBooth.id,
            status: existingBooth.is_acc,
          },
        });
      }
    }

    // Insert new booth application
    const { data, error } = await supabase
      .from("booth")
      .insert({
        name: name.trim(),
        phone: parseInt(phone),
        event_id: parseInt(event_id),
        desc: desc.trim(),
        is_acc: "PENDING", // Default status
      })
      .select(
        `
        *,
        event:event_id (id, name, start_date, end_date, location)
      `
      )
      .single();

    if (error) {
      console.error("Create booth error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create booth application",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Booth application submitted successfully",
      data,
    });
  } catch (error) {
    console.error("Create booth error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all booths
controller.getAllBooths = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      event_id,
      is_acc, // Filter by approval status
      sort_by = "id",
      sort_order = "desc", // Latest first by default
    } = req.query;

    const offset = (page - 1) * limit;

    // Validate sort parameters
    const allowedSortBy = ["id", "name", "phone", "is_acc"];
    const allowedSortOrder = ["asc", "desc"];
    const allowedStatus = ["PENDING", "ACCEPT", "REJECT"];

    const sortBy = allowedSortBy.includes(sort_by) ? sort_by : "id";
    const sortOrder = allowedSortOrder.includes(sort_order)
      ? sort_order
      : "desc";

    let query = supabase
      .from("booth")
      .select(
        `
        *,
        event:event_id (id, name, start_date, end_date, location, category)
      `,
        { count: "exact" }
      )
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    // Add filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,desc.ilike.%${search}%`);
    }

    if (event_id) {
      query = query.eq("event_id", event_id);
    }

    if (is_acc && allowedStatus.includes(is_acc.toUpperCase())) {
      query = query.eq("is_acc", is_acc.toUpperCase());
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get booths error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch booths",
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
      filters: {
        search,
        event_id,
        status: is_acc,
      },
    });
  } catch (error) {
    console.error("Get booths error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get booth by ID
controller.getBoothById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid booth ID is required",
      });
    }

    const { data, error } = await supabase
      .from("booth")
      .select(
        `
        *,
        event:event_id (
          id, 
          name, 
          start_date, 
          end_date, 
          location, 
          category,
          description,
          price
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get booth by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get booths by event ID
controller.getBoothsByEventId = async (req, res) => {
  try {
    const { event_id } = req.params;
    const {
      is_acc = "ACCEPT", // Default to show only accepted booths for public view
      include_pending = false,
    } = req.query;

    // Validate event_id
    if (!event_id || isNaN(parseInt(event_id))) {
      return res.status(400).json({
        success: false,
        message: "Valid event ID is required",
      });
    }

    let query = supabase
      .from("booth")
      .select(
        `
        *,
        event:event_id (id, name, start_date, end_date, location)
      `
      )
      .eq("event_id", event_id)
      .order("id", { ascending: false });

    // Apply status filter
    if (include_pending === "true") {
      query = query.in("is_acc", ["ACCEPT", "PENDING"]);
    } else if (is_acc) {
      query = query.eq("is_acc", is_acc.toUpperCase());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Get booths by event error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch booths for this event",
        error: error.message,
      });
    }

    res.json({
      success: true,
      data,
      event_id: parseInt(event_id),
      total_booths: data.length,
    });
  } catch (error) {
    console.error("Get booths by event error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update booth application
controller.updateBooth = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, desc } = req.body;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid booth ID is required",
      });
    }

    // Check if booth exists
    const { data: existingBooth, error: fetchError } = await supabase
      .from("booth")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingBooth) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    // Check if booth can still be updated (only PENDING applications can be updated)
    if (existingBooth.is_acc !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot update booth application with status: ${existingBooth.is_acc}`,
        current_status: existingBooth.is_acc,
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
          message: "Invalid phone number format (10-15 digits)",
        });
      }
      updateData.phone = parseInt(phone);
    }

    // Validate at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    // Update booth
    const { data, error } = await supabase
      .from("booth")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        event:event_id (id, name, start_date, end_date, location)
      `
      )
      .single();

    if (error) {
      console.error("Update booth error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update booth application",
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: "Booth application updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update booth error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update booth approval status (Admin only)
controller.updateBoothStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_acc } = req.body;

    console.log("=== UPDATE BOOTH STATUS DEBUG ===");
    console.log("Booth ID:", id);
    console.log("New status:", is_acc);

    // Validate booth ID
    if (!id || isNaN(parseInt(id))) {
      console.error("Invalid booth ID:", id);
      return res.status(400).json({
        success: false,
        message: "Valid booth ID is required",
      });
    }

    // Validate status
    const allowedStatuses = ["PENDING", "APPROVED", "REJECTED"];
    if (!is_acc || !allowedStatuses.includes(is_acc.toUpperCase())) {
      console.error("Invalid status:", is_acc);
      return res.status(400).json({
        success: false,
        message: "Status must be one of: PENDING, APPROVED, REJECTED",
      });
    }

    // Check if booth exists
    const { data: existingBooth, error: fetchError } = await supabase
      .from("booth")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingBooth) {
      console.log("Booth not found:", fetchError);
      return res.status(404).json({
        success: false,
        message: "Booth application not found",
      });
    }

    console.log("Existing booth:", existingBooth);

    // Update booth status
    const { data, error } = await supabase
      .from("booth")
      .update({ is_acc: is_acc.toUpperCase() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Update booth error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update booth status",
        error: error.message,
      });
    }

    console.log("Updated booth:", data);

    res.json({
      success: true,
      message: "Booth status updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update booth status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE - Delete booth application
controller.deleteBooth = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid booth ID is required",
      });
    }

    // Check if booth exists
    const { data: existingBooth, error: fetchError } = await supabase
      .from("booth")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingB()) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    // Delete booth
    const { error: deleteError } = await supabase
      .from("booth")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete booth error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete booth application",
        error: deleteError.message,
      });
    }

    res.json({
      success: true,
      message: "Booth application deleted successfully",
      data: {
        deletedBooth: existingBooth,
      },
    });
  } catch (error) {
    console.error("Delete booth error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get booth statistics
controller.getBoothStatistics = async (req, res) => {
  try {
    const { event_id } = req.query;

    let query = supabase.from("booth").select("is_acc, event_id");

    if (event_id) {
      query = query.eq("event_id", event_id);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate statistics
    const stats = {
      total_applications: data.length,
      pending: data.filter((booth) => booth.is_acc === "PENDING").length,
      accepted: data.filter((booth) => booth.is_acc === "ACCEPT").length,
      rejected: data.filter((booth) => booth.is_acc === "REJECT").length,
    };

    // Add percentages
    if (stats.total_applications > 0) {
      stats.acceptance_rate = Math.round(
        (stats.accepted / stats.total_applications) * 100
      );
      stats.rejection_rate = Math.round(
        (stats.rejected / stats.total_applications) * 100
      );
      stats.pending_rate = Math.round(
        (stats.pending / stats.total_applications) * 100
      );
    }

    // If specific event, get event info
    if (event_id) {
      const { data: event, error: eventError } = await supabase
        .from("event")
        .select("id, name")
        .eq("id", event_id)
        .single();

      if (!eventError && event) {
        stats.event = event;
      }
    }

    res.json({
      success: true,
      message: "Booth statistics retrieved successfully",
    });
  } catch (error) {
    console.error("Get booth statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// BULK operations - Bulk update booth status (Admin only)
controller.bulkUpdateBoothStatus = async (req, res) => {
  try {
    const { booth_ids, is_acc, admin_notes } = req.body;

    // Validate input
    if (!booth_ids || !Array.isArray(booth_ids) || booth_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Booth IDs array is required",
      });
    }

    // Validate status
    const allowedStatus = ["PENDING", "ACCEPT", "REJECT"];
    if (!is_acc || !allowedStatus.includes(is_acc.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required (PENDING, ACCEPT, REJECT)",
      });
    }

    // Update booths
    const updateData = {
      is_acc: is_acc.toUpperCase(),
    };

    if (admin_notes) {
      updateData.admin_notes = admin_notes.trim();
    }

    const { data, error } = await supabase
      .from("booth")
      .update(updateData)
      .in("id", booth_ids).select(`
        *,
        event:event_id (id, name)
      `);

    if (error) {
      console.error("Bulk update booth status error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update booth statuses",
        error: error.message,
      });
    }

    // Log admin action
    console.log(
      `Admin ${req.user?.email} bulk updated ${
        booth_ids.length
      } booths to ${is_acc.toUpperCase()}`
    );

    res.json({
      success: true,
      message: `${
        data.length
      } booth applications ${is_acc.toLowerCase()}ed successfully`,
      data,
      updated_count: data.length,
      updated_by: req.user?.email,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Bulk update booth status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = controller;
