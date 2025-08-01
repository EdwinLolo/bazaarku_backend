// controllers/event_category_controller.js
const supabase = require("../db/supabase");

const controller = {};

// CREATE - Add new event category
controller.createEventCategory = async (req, res) => {
  try {
    const { name } = req.body;

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // Check if category name already exists
    const { data: existingCategory, error: checkError } = await supabase
      .from("event_category")
      .select("id, name")
      .ilike("name", name.trim())
      .single();

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category name already exists",
        existing_category: existingCategory,
      });
    }

    // Insert new category
    const { data, error } = await supabase
      .from("event_category")
      .insert({
        name: name.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error("Create event category error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create event category",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Event category created successfully",
      data,
    });
  } catch (error) {
    console.error("Create event category error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all event categories
controller.getAllEventCategories = async (req, res) => {
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
      .from("event_category")
      .select("*", { count: "exact" })
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    // Add search functionality
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get event categories error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch event categories",
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
    console.error("Get event categories error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get event category by ID
controller.getEventCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid category ID is required",
      });
    }

    const { data, error } = await supabase
      .from("event_category")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Event category not found",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get event category by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get event category with events count
controller.getEventCategoryWithCount = async (req, res) => {
  try {
    const { id } = req.params;

    // Get category with events count
    const { data, error } = await supabase
      .from("event_category")
      .select(
        `
        *,
        event:id (count)
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Event category not found",
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
    console.error("Get event category with count error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all categories with events count
controller.getAllCategoriesWithCount = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("event_category")
      .select(
        `
        *,
        event:id (count)
      `
      )
      .order("name", { ascending: true });

    if (error) {
      console.error("Get categories with count error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch event categories",
        error: error.message,
      });
    }

    // Process data to add events count
    const processedData = data.map((category) => ({
      id: category.id,
      name: category.name,
      events_count: category.event[0]?.count || 0,
    }));

    res.json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Get categories with count error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update event category
controller.updateEventCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid category ID is required",
      });
    }

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // Check if category exists
    const { data: existingCategory, error: fetchError } = await supabase
      .from("event_category")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Event category not found",
      });
    }

    // Check if new name already exists (excluding current category)
    const { data: duplicateCategory, error: duplicateError } = await supabase
      .from("event_category")
      .select("id, name")
      .ilike("name", name.trim())
      .neq("id", id)
      .single();

    if (duplicateCategory) {
      return res.status(400).json({
        success: false,
        message: "Category name already exists",
        existing_category: duplicateCategory,
      });
    }

    // Update category
    const { data, error } = await supabase
      .from("event_category")
      .update({
        name: name.trim(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update event category error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update event category",
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: "Event category updated successfully",
      data,
      changes: {
        old_name: existingCategory.name,
        new_name: data.name,
      },
    });
  } catch (error) {
    console.error("Update event category error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE - Delete event category
controller.deleteEventCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.query; // Allow force delete with query param

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Valid category ID is required",
      });
    }

    // Check if category exists
    const { data: existingCategory, error: fetchError } = await supabase
      .from("event_category")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Event category not found",
      });
    }

    // Check if category has associated events
    const { data: associatedEvents, error: eventsError } = await supabase
      .from("event")
      .select("id, name")
      .eq("event_category_id", id)
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
        message: "Cannot delete category with associated events",
        associated_events_count: associatedEvents.length,
        sample_events: associatedEvents,
        suggestion:
          "Use ?force=true to delete anyway (this will affect associated events)",
      });
    }

    // Delete category
    const { error: deleteError } = await supabase
      .from("event_category")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete event category error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete event category",
        error: deleteError.message,
      });
    }

    res.json({
      success: true,
      message: "Event category deleted successfully",
      edCategory: existingCategory,
      affected_events_count: associatedEvents ? associatedEvents.length : 0,
    });
  } catch (error) {
    console.error("Delete event category error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// BULK operations
controller.bulkCreateEventCategories = async (req, res) => {
  try {
    const { categories } = req.body;

    // Validate input
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Categories array is required",
      });
    }

    // Validate each category
    const validCategories = [];
    const errors = [];

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      if (!category.name || category.name.trim() === "") {
        errors.push(`Category at index ${i}: name is required`);
      } else {
        validCategories.push({
          name: category.name.trim(),
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

    // Insert categories
    const { data, error } = await supabase
      .from("event_category")
      .insert(validCategories)
      .select();

    if (error) {
      console.error("Bulk create event categories error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create event categories",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: `${data.length} event categories created successfully`,
      data,
    });
  } catch (error) {
    console.error("Bulk create event categories error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = controller;
