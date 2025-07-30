// controllers/rental_products_controller.js
const supabase = require("../db/supabase");

const controller = {};

// CREATE - Add new rental product
controller.createRentalProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      rental_id,
      location,
      contact,
      banner,
      is_ready = true,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !description ||
      !price ||
      !rental_id ||
      !location ||
      !contact
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, description, price, rental_id, location, and contact are required",
      });
    }

    // Validate price is positive
    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be greater than 0",
      });
    }

    // Check if rental exists
    const { data: rental, error: rentalError } = await supabase
      .from("rental")
      .select("id, name")
      .eq("id", rental_id)
      .single();

    if (rentalError || !rental) {
      return res.status(400).json({
        success: false,
        message: "Invalid rental_id. Rental not found",
      });
    }

    // Insert new rental product
    const { data, error } = await supabase
      .from("rental_products")
      .insert({
        name: name.trim(),
        description: description.trim(),
        price: parseInt(price),
        rental_id: parseInt(rental_id),
        location: location.trim(),
        contact: contact.trim(),
        banner,
        is_ready,
      })
      .select(
        `
        *,
        rental:rental_id (id, name)
      `
      )
      .single();

    if (error) {
      console.error("Create rental product error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create rental product",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Rental product created successfully",
      data,
    });
  } catch (error) {
    console.error("Create rental product error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get all rental products
controller.getAllRentalProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      rental_id,
      is_ready,
      min_price,
      max_price,
      location,
    } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("rental_products")
      .select(
        `
        *,
        rental:rental_id (id, name)
      `,
        { count: "exact" }
      )
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    // Add filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (rental_id) {
      query = query.eq("rental_id", rental_id);
    }

    if (is_ready !== undefined) {
      query = query.eq("is_ready", is_ready === "true");
    }

    if (min_price) {
      query = query.gte("price", parseInt(min_price));
    }

    if (max_price) {
      query = query.lte("price", parseInt(max_price));
    }

    if (location) {
      query = query.ilike("location", `%${location}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Get rental products error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch rental products",
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
    console.error("Get rental products error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// READ - Get rental product by ID
controller.getRentalProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("rental_products")
      .select(
        `
        *,
        rental:rental_id (id, name, banner)
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Rental product not found",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get rental product by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// UPDATE - Update rental product
controller.updateRentalProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      rental_id,
      location,
      contact,
      banner,
      is_ready,
    } = req.body;

    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from("rental_products")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Rental product not found",
      });
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (price !== undefined) {
      if (price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be greater than 0",
        });
      }
      updateData.price = parseInt(price);
    }
    if (rental_id !== undefined) {
      // Validate rental exists
      const { data: rental, error: rentalError } = await supabase
        .from("rental")
        .select("id")
        .eq("id", rental_id)
        .single();

      if (rentalError || !rental) {
        return res.status(400).json({
          success: false,
          message: "Invalid rental_id. Rental not found",
        });
      }
      updateData.rental_id = parseInt(rental_id);
    }
    if (location !== undefined) updateData.location = location.trim();
    if (contact !== undefined) updateData.contact = contact.trim();
    if (banner !== undefined) updateData.banner = banner;
    if (is_ready !== undefined) updateData.is_ready = is_ready;

    // Validate at least one field to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required to update",
      });
    }

    // Update product
    const { data, error } = await supabase
      .from("rental_products")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        rental:rental_id (id, name)
      `
      )
      .single();

    if (error) {
      console.error("Update rental product error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update rental product",
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: "Rental product updated successfully",
      data,
    });
  } catch (error) {
    console.error("Update rental product error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE - Delete rental product
controller.deleteRentalProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from("rental_products")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Rental product not found",
      });
    }

    // Delete product
    const { error: deleteError } = await supabase
      .from("rental_products")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete rental product error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete rental product",
        error: deleteError.message,
      });
    }

    res.json({
      success: true,
      message: "Rental product deleted successfully",
      data: {
        deletedProduct: existingProduct,
      },
    });
  } catch (error) {
    console.error("Delete rental product error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = controller;
