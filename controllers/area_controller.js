// controllers/area_controller.js
const supabase = require("../db/supabase");

const controller = {};

// CREATE - Add new area
controller.createArea = async (req, res) => {
  try {
    const { name } = req.body;

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Area name is required",
      });
    }

    // Check if area name already exists
    const { data: existingArea, error: checkError } = await supabase
      .from("area")
      .select("id, name")
      .ilike("name", name.trim())
      .single();

    if (existingArea) {
      return res.status(400).json({
        success: false,
        message: "Area name already exists",
        existing_area: existingArea,
      });
    }

    // Insert new area
    const { data, error } = await supabase
      .from("area")
      .insert({
        name: name.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error("Create area error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create area",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Area created successfully",
      data,
    });
  } catch (error) {
    console.error("Create area error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all areas
controller.getAllAreas = async (req, res) => {
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
    const allowedSortBy = ["id", "name"];
    const allowedSortOrder = ["asc", "desc"];

    const sortBy = allowedSortBy.includes(sort_by) ? sort_by : "name";
    const sortOrder = allowedSortOrder.includes(sort_order)
      ? sort_order
      : "asc";

    let query = supabase
      .from("area")
      .select("*", { count: "exact" })
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    // Add search functionality
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get areas error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch areas",
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
    console.error("Get areas error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get area by ID
controller.getAreaById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid area ID is required",
      });
    }

    const { data, error } = await supabase
      .from("area")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get area by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get area with events count
controller.getAreaWithCount = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid area ID is required",
      });
    }

    // Get area with events count
    const { data, error } = await supabase
      .from("area")
      .select(
        `
        *,
        event:area_id (count)
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...data,
        events_count: data.event[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error("Get area with count error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all areas with events count
controller.getAllAreasWithCount = async (req, res) => {
  try {
    const { search, sort_by = "name", sort_order = "asc" } = req.query;

    // Validate sort parameters
    const allowedSortBy = ["id", "name", "events_count"];
    const allowedSortOrder = ["asc", "desc"];

    const sortBy = allowedSortBy.includes(sort_by) ? sort_by : "name";
    const sortOrder = allowedSortOrder.includes(sort_order)
      ? sort_order
      : "asc";

    let query = supabase.from("area").select(`
        *,
        event:area_id (count)
      `);

    // Add search if provided
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Get areas with count error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch areas",
        error: error.message,
      });
    }

    // Process data to add events count and sort
    let processedData = data.map((area) => ({
      id: area.id,
      name: area.name,
      events_count: area.event[0]?.count || 0,
    }));

    // Sort the processed data
    processedData.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    res.json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Get areas with count error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get areas for dropdown (simple list)
controller.getAreasDropdown = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("area")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Get areas dropdown error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch areas",
        error: error.message,
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get areas dropdown error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update area
controller.updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid area ID is required",
      });
    }

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Area name is required",
      });
    }

    // Check if area exists
    const { data: existingArea, error: fetchError } = await supabase
      .from("area")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingArea) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    // Check if new name already exists (excluding current area)
    const { data: duplicateArea, error: duplicateError } = await supabase
      .from("area")
      .select("id, name")
      .ilike("name", name.trim())
      .neq("id", id)
      .single();

    if (duplicateArea) {
      return res.status(400).json({
        success: false,
        message: "Area name already exists",
        existing_area: duplicateArea,
      });
    }

    // Update area
    const { data, error } = await supabase
      .from("area")
      .update({
        name: name.trim(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update area error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update area",
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: "Area updated successfully",
      data,
      changes: {
        old_name: existingArea.name,
        new_name: data.name,
      },
    });
  } catch (error) {
    console.error("Update area error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE - Delete area
controller.deleteArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.query; // Allow force delete with query param

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid area ID is required",
      });
    }

    // Check if area exists
    const { data: existingArea, error: fetchError } = await supabase
      .from("area")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingArea) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    // Check if area has associated events
    const { data: associatedEvents, error: eventsError } = await supabase
      .from("event")
      .select("id, name")
      .eq("area_id", id)
      .limit(5); // Limit to show examples

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
        message: "Cannot delete area with associated events",
        associated_events_count: associatedEvents.length,
        sample_events: associatedEvents,
        suggestion:
          "Use ?force=true to delete anyway (this will affect associated events)",
      });
    }

    // Delete area
    const { error: deleteError } = await supabase
      .from("area")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete area error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete area",
        error: deleteError.message,
      });
    }

    res.json({
      success: true,
      message: "Area deleted successfully",
      deletedArea: existingArea,
      affected_events_count: associatedEvents ? associatedEvents.length : 0,
    });
  } catch (error) {
    console.error("Delete area error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// BULK operations
controller.bulkCreateAreas = async (req, res) => {
  try {
    const { areas } = req.body;

    // Validate input
    if (!areas || !Array.isArray(areas) || areas.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Areas array is required",
      });
    }

    // Validate each area
    const validAreas = [];
    const errors = [];

    for (let i = 0; i < areas.length; i++) {
      const area = areas[i];
      if (!area.name || area.name.trim() === "") {
        errors.push(`Area at index ${i}: name is required`);
      } else {
        validAreas.push({
          name: area.name.trim(),
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors,
      });
    }

    // Insert areas
    const { data, error } = await supabase
      .from("area")
      .insert(validAreas)
      .select();

    if (error) {
      console.error("Bulk create areas error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create areas",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: `${data.length} areas created successfully`,
      data,
    });
  } catch (error) {
    console.error("Bulk create areas error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get area statistics
controller.getAreaStatistics = async (req, res) => {
  try {
    // Get total areas count
    const { count: totalAreas, error: countError } = await supabase
      .from("area")
      .select("*", { count: "exact", head: true });

    if (countError) {
      throw countError;
    }

    // Get areas with most events
    const { data: areasWithEvents, error: eventsError } = await supabase
      .from("area")
      .select(
        `
        id,
        name,
        event:area_id (count)
      `
      )
      .order("name", { ascending: true });

    if (eventsError) {
      throw eventsError;
    }

    // Process and sort by events count
    const processedAreas = areasWithEvents
      .map((area) => ({
        id: area.id,
        name: area.name,
        events_count: area.event[0]?.count || 0,
      }))
      .sort((a, b) => b.events_count - a.events_count);

    const areasWithEvents_count = processedAreas.filter(
      (area) => area.events_count > 0
    ).length;
    const areasWithoutEvents = processedAreas.filter(
      (area) => area.events_count === 0
    ).length;
    const topAreas = processedAreas.slice(0, 5); // Top 5 areas with most events

    res.json({
      success: true,
      data: {
        total_areas: totalAreas,
        areas_with_events: areasWithEvents_count,
        areas_without_events: areasWithoutEvents,
        top_areas_by_events: topAreas,
        total_events: processedAreas.reduce(
          (sum, area) => sum + area.events_count,
          0
        ),
      },
    });
  } catch (error) {
    console.error("Get area statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = controller;
