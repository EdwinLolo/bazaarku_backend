const express = require("express");
const supabase = require("../db/supabase");

const controller = {};

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
    const { name, banner } = req.body;

    // Validate required fields
    if (!name || !banner) {
      return res.status(400).json({
        success: false,
        message: "Name and banner are required",
      });
    }

    // Insert new rental
    const { data, error } = await supabase
      .from("rental")
      .insert({
        name: name.trim(),
        banner,
      })
      .select()
      .single();

    if (error) {
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
    });
  } catch (error) {
    console.error("Create rental error:", error);
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
    const { name, banner } = req.body;

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
    if (name !== undefined) updateData.name = name.trim();
    if (banner !== undefined) updateData.banner = banner;

    // Validate at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    // Update rental
    const { data, error } = await supabase
      .from("rental")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update rental error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update rental",
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: "Rental updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update rental error:", error);
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

module.exports = controller;
