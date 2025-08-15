// controllers/rating_controller.js
const supabase = require("../db/supabase");

const controller = {};

// CREATE - Add new rating
controller.createRating = async (req, res) => {
  try {
    const { name, review, event_id, rating_star } = req.body;

    console.log("=== CREATE RATING DEBUG ===");
    console.log("Request body:", req.body);

    // Validate required fields
    if (!name || !event_id || !rating_star) {
      return res.status(400).json({
        success: false,
        message: "Name, event_id, and rating_star are required",
      });
    }

    // Validate rating_star range (1-5)
    if (rating_star < 1 || rating_star > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating star must be between 1 and 5",
      });
    }

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from("event")
      .select("id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return res.status(400).json({
        success: false,
        message: "Invalid event_id. Event not found",
      });
    }

    // Prepare insert data
    const insertData = {
      name: name.trim(),
      review: review ? review.trim() : null,
      event_id: parseInt(event_id),
      rating_star: parseInt(rating_star),
    };

    console.log("Insert data:", insertData);

    // Insert new rating
    const { data, error } = await supabase
      .from("rating")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      console.error("Create rating error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create rating",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Rating created successfully",
      data,
    });
  } catch (error) {
    console.error("Create rating error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all ratings with optional filters
controller.getRatings = async (req, res) => {
  try {
    const { event_id, rating_star, limit = 50, offset = 0 } = req.query;
    console.log("=== GET RATINGS DEBUG ===");
    console.log("Query params:", req.query);

    let query = supabase
      .from("rating")
      .select("*")
      .order("id", { ascending: false });

    // Apply filters
    if (event_id) {
      query = query.eq("event_id", event_id);
    }

    if (rating_star) {
      query = query.eq("rating_star", rating_star);
    }

    // Apply pagination
    query = query.range(
      parseInt(offset),
      parseInt(offset) + parseInt(limit) - 1
    );

    const { data, error } = await query;

    if (error) {
      console.error("Get ratings error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch ratings",
        error: error.message,
      });
    }

    // Get total count for pagination (with same filters)
    let countQuery = supabase
      .from("rating")
      .select("*", { count: "exact", head: true });

    // Apply same filters to count query
    if (event_id) {
      countQuery = countQuery.eq("event_id", event_id);
    }

    if (rating_star) {
      countQuery = countQuery.eq("rating_star", rating_star);
    }

    const { count: totalCount } = await countQuery;

    res.json({
      success: true,
      data,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalCount,
      },
    });
  } catch (error) {
    console.error("Get ratings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - get rating by event id
controller.getRatingsByEventId = async (req, res) => {
  try {
    const { event_id } = req.params;
    console.log("=== GET RATINGS BY EVENT ID DEBUG ===");
    console.log("Event ID:", event_id);

    const { data, error } = await supabase
      .from("rating")
      .select("*")
      .eq("event_id", event_id);

    if (error) {
      console.error("Get ratings by event ID error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch ratings",
        error: error.message,
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get ratings by event ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get single rating by ID
controller.getRatingById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("=== GET RATING BY ID DEBUG ===");
    console.log("Rating ID:", id);

    const { data, error } = await supabase
      .from("rating")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Rating not found",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get rating by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get ratings for a specific event
controller.getRatingsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    console.log("=== GET RATINGS BY EVENT DEBUG ===");
    console.log("Event ID:", event_id);

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from("event")
      .select("id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const { data, error } = await supabase
      .from("rating")
      .select("*")
      .eq("event_id", event_id)
      .order("id", { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      console.error("Get ratings by event error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch ratings",
        error: error.message,
      });
    }

    // Get total count for this event
    const { count: totalCount } = await supabase
      .from("rating")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event_id);

    res.json({
      success: true,
      data,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalCount,
      },
    });
  } catch (error) {
    console.error("Get ratings by event error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get ratings statistics for an event
controller.getEventRatingStats = async (req, res) => {
  try {
    const { event_id } = req.params;

    console.log("=== GET EVENT RATING STATS DEBUG ===");
    console.log("Event ID:", event_id);

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from("event")
      .select("id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Get all ratings for the event
    const { data: ratings, error } = await supabase
      .from("rating")
      .select("rating_star")
      .eq("event_id", event_id);

    if (error) {
      console.error("Get rating stats error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch rating statistics",
        error: error.message,
      });
    }

    if (!ratings || ratings.length === 0) {
      return res.json({
        success: true,
        data: {
          event_id: parseInt(event_id),
          total_ratings: 0,
          average_rating: 0,
          rating_distribution: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
          },
        },
      });
    }

    // Calculate statistics
    const totalRatings = ratings.length;
    const sum = ratings.reduce((acc, rating) => acc + rating.rating_star, 0);
    const averageRating = (sum / totalRatings).toFixed(2);

    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((rating) => {
      distribution[rating.rating_star]++;
    });

    res.json({
      success: true,
      data: {
        event_id: parseInt(event_id),
        total_ratings: totalRatings,
        average_rating: parseFloat(averageRating),
        rating_distribution: distribution,
      },
    });
  } catch (error) {
    console.error("Get rating stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update rating
controller.updateRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, review, event_id, rating_star } = req.body;

    console.log("=== UPDATE RATING DEBUG ===");
    console.log("Rating ID:", id);
    console.log("Request body:", req.body);

    // Check if rating exists
    const { data: existingRating, error: fetchError } = await supabase
      .from("rating")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRating) {
      return res.status(404).json({
        success: false,
        message: "Rating not found",
      });
    }

    // Prepare update data
    const updateData = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
      updateData.name = name.trim();
    }

    if (review !== undefined) {
      updateData.review = review ? review.trim() : null;
    }

    if (event_id !== undefined) {
      // Validate event exists
      const { data: event, error: eventError } = await supabase
        .from("event")
        .select("id")
        .eq("id", event_id)
        .single();

      if (eventError || !event) {
        return res.status(400).json({
          success: false,
          message: "Invalid event_id. Event not found",
        });
      }
      updateData.event_id = parseInt(event_id);
    }

    if (rating_star !== undefined) {
      if (rating_star < 1 || rating_star > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating star must be between 1 and 5",
        });
      }
      updateData.rating_star = parseInt(rating_star);
    }

    // Validate at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    console.log("Update data:", updateData);

    // Update rating
    const { data, error } = await supabase
      .from("rating")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Update rating error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update rating",
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: "Rating updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update rating error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE - Delete rating
controller.deleteRating = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("=== DELETE RATING DEBUG ===");
    console.log("Rating ID:", id);

    // Check if rating exists
    const { data: existingRating, error: fetchError } = await supabase
      .from("rating")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRating) {
      return res.status(404).json({
        success: false,
        message: "Rating not found",
      });
    }

    // Delete rating
    const { error } = await supabase.from("rating").delete().eq("id", id);

    if (error) {
      console.error("Delete rating error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete rating",
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: "Rating deleted successfully",
      data: {
        deleted_id: parseInt(id),
      },
    });
  } catch (error) {
    console.error("Delete rating error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE - Delete all ratings for an event
controller.deleteEventRatings = async (req, res) => {
  try {
    const { event_id } = req.params;

    console.log("=== DELETE EVENT RATINGS DEBUG ===");
    console.log("Event ID:", event_id);

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from("event")
      .select("id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Get count of ratings to be deleted
    const { count } = await supabase
      .from("rating")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event_id);

    // Delete all ratings for the event
    const { error } = await supabase
      .from("rating")
      .delete()
      .eq("event_id", event_id);

    if (error) {
      console.error("Delete event ratings error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete event ratings",
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: `Successfully deleted ${count} rating(s) for event ${event_id}`,
      data: {
        event_id: parseInt(event_id),
        deleted_count: count,
      },
    });
  } catch (error) {
    console.error("Delete event ratings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = controller;
