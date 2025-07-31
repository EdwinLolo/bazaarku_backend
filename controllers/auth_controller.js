const express = require("express");
const supabase = require("../db/supabase");

const controller = {};

controller.signup = async (req, res) => {
  try {
    const { email, password, first_name, last_name, role = "user" } = req.body;
    console.log("Signup request body:", req.body);

    // Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error("Supabase signup error:", authError);
      return res.status(400).json({ error: authError.message });
    }

    // Create user profile if user was created successfully
    if (authData.user) {
      const { data: profileData, error: profileError } = await supabase
        .from("user")
        .insert({
          id: authData.user.id,
          email: email,
          //   password: null, // Note: Storing password in plain text is not recommended
          role: role, // Default role
          first_name: first_name,
          last_name: last_name,
        })
        .select()
        .single();

      if (profileError) {
        console.error("Profile creation error:", profileError);
      }

      res.json({
        user: authData.user,
        profile: profileData,
        session: authData.session,
      });
    } else {
      res.json(authData);
    }
  } catch (e) {
    console.error("Unexpected error:", e);
    res.status(500).json({
      error: "Internal server error",
      details: e.toString(),
    });
  }
};

controller.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login request body:", req.body);

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      console.error("Supabase login error:", authError);
      return res.status(400).json({ error: authError.message });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("user")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    console.log("User profile data:", profile);
    console.log("User ID:", authData.user.id);
    console.log("Session token:", authData.session.access_token);

    res.status(200).json({
      user: authData.user,
      user_id: authData.user.id,
      profile: profile,
      session: authData.session.access_token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

controller.logout = async (req, res) => {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "No valid session found",
      });
    }

    // Extract the token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Set the session for this specific user/token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({
        error: "Invalid session",
      });
    }

    // Perform the logout with the specific session
    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      console.error("Logout error:", error);
      return res.status(500).json({
        error: "Logout failed",
        details: error.message,
      });
    }

    // Log the logout event (optional but recommended)
    console.log(`User ${user.email} logged out successfully`);

    res.json({
      message: "Logged out successfully",
      user_id: user.id,
    });
  } catch (error) {
    console.error("Unexpected logout error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.toString(),
    });
  }
};

// controller.logout = async (req, res) => {
//   try {
//     const { error } = await supabase.auth.signOut();
//     if (error) {
//       console.error("Logout error:", error);
//       return res.status(500).json({ error: "Logout failed" });
//     }
//     res.json({ message: "Logged out successfully" });
//   } catch (error) {
//     console.error("Unexpected logout error:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

controller.GetAdminAllUsers = async (req, res) => {
  try {
    const { data, error } = await supabase.from("user").select("*");

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

controller.AdminChangeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, first_name, last_name } = req.body;

    // Validate required fields
    if (!role) {
      console.error("Role is required for changing user role");
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    // Validate role values (adjust based on your allowed roles)
    const allowedRoles = ["admin", "vendor", "user"]; // Add your allowed roles
    if (!allowedRoles.includes(role)) {
      console.error("Invalid role specified:", role);
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    // Check if user exists first
    const { data: existingUser, error: fetchError } = await supabase
      .from("user")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !existingUser) {
      console.error("User not found:", fetchError);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prepare update data
    const updateData = { role };

    if (first_name !== undefined) {
      updateData.first_name = first_name;
    }

    if (last_name !== undefined) {
      updateData.last_name = last_name;
    }

    // Update user role and other fields
    const { data: updatedUser, error: updateError } = await supabase
      .from("user")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({
        success: false,
        message: "Failed to update user role",
        error: updateError.message,
      });
    }

    // Return success response
    console.log(
      `User role updated successfully: ${updatedUser.email} is now ${updatedUser.role}`
    );
    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: {
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
      },
    });
  } catch (error) {
    console.error("AdminChangeUserRole error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

controller.AdminDeleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUser = req.user; // From authenticate middleware

    // Validate userId
    if (!userId || userId.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required",
      });
    }

    // Prevent admin from deleting themselves
    if (userId === adminUser.id) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    // FIRST: Check if user exists in profiles
    const { data: existingUser, error: fetchError } = await supabase
      .from("user")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found in database",
      });
    }

    console.log(
      `Admin ${adminUser.email} attempting to delete user: ${existingUser.email}`
    );

    // SECOND: Check if auth user exists (but don't fail if it doesn't)
    let authUserExists = false;
    try {
      const { data: authUser, error: authFetchError } =
        await supabase.auth.admin.getUserById(userId);

      if (!authFetchError && authUser?.user) {
        authUserExists = true;
        console.log("Auth user found, will delete from both auth and profile");
      } else {
        console.log("Auth user not found, will only delete from profile");
      }
    } catch (authError) {
      console.log("Error checking auth user:", authError.message);
      // Continue with profile deletion even if auth check fails
    }

    // THIRD: Delete from auth if exists
    if (authUserExists) {
      try {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
          userId
        );

        if (authDeleteError) {
          console.error("Auth delete error:", authDeleteError);
          return res.status(500).json({
            success: false,
            message: "Failed to delete user from authentication system",
            error: authDeleteError.message,
          });
        }
        console.log("Successfully deleted from auth");
      } catch (authError) {
        console.error("Unexpected auth delete error:", authError);
        return res.status(500).json({
          success: false,
          message: "Failed to delete user from authentication system",
          error: authError.message,
        });
      }
    }

    // FOURTH: Delete user profile
    const { error: deleteError } = await supabase
      .from("user")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      console.error("Profile delete error:", deleteError);
      return res.status(500).json({
        success: false,
        message: authUserExists
          ? "Auth user deleted but failed to delete profile"
          : "Failed to delete user profile",
        error: deleteError.message,
      });
    }

    // FIFTH: Clean up related data (optional)
    try {
      // Delete related vendor data if user was a vendor
      if (existingUser.role === "vendor") {
        const { error: vendorDeleteError } = await supabase
          .from("vendor")
          .delete()
          .eq("user_id", userId);

        if (vendorDeleteError) {
          console.error("Vendor cleanup error:", vendorDeleteError);
          // Don't fail the request, just log the error
        }
      }
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
      // Don't fail the request for cleanup errors
    }

    console.log(`Successfully deleted user: ${existingUser.email}`);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: {
        deletedUserId: userId,
        deletedUserEmail: existingUser.email,
        deletedFromAuth: authUserExists,
        deletedFromProfile: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("AdminDeleteUser error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

controller.testingauth = (req, res) => {
  res.json({ message: "Testing auth route" });
};

module.exports = controller;
