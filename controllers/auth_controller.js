const express = require("express");
const supabase = require("../db/supabase");

const controller = {};

controller.signup = async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;
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
        .from("User")
        .insert({
          id: authData.user.id,
          email: email,
          password: password, // Note: Storing password in plain text is not recommended
          role: "user", // Default role
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
      .from("User")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    res.json({
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
    const { data, error } = await supabase.from("User").select("*");

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// controller.AdminChangeUserRole = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const { role, grade, school_name, name } = req.body;

//     // Validate required fields
//     if (!role) {
//       return res.status(400).json({
//         success: false,
//         message: "Role is required",
//       });
//     }

//     // Validate role values (adjust based on your allowed roles)
//     const allowedRoles = ["admin", "teacher", "student", "user"]; // Add your allowed roles
//     if (!allowedRoles.includes(role)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid role specified",
//       });
//     }

//     // Check if user exists first
//     const { data: existingUser, error: fetchError } = await supabase
//       .from("profiles")
//       .select("*")
//       .eq("user_id", userId)
//       .single();

//     if (fetchError || !existingUser) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Prepare update data
//     const updateData = { role };

//     // Only include grade and school_name if they are provided
//     if (grade !== undefined) {
//       updateData.grade = grade;
//     }
//     if (school_name !== undefined) {
//       switch (school_name) {
//         case 1:
//           updateData.school_name = "SD 1";
//           break;
//         case 2:
//           updateData.school_name = "SD 2";
//           break;
//         case 3:
//           updateData.school_name = "SD 3";
//           break;
//         default:
//           updateData.school_name = "Unknown School";
//       }
//     }
//     if (name !== undefined) {
//       updateData.name = name;
//     }

//     // Update user role and other fields
//     const { data: updatedUser, error: updateError } = await supabase
//       .from("profiles")
//       .update(updateData)
//       .eq("user_id", userId)
//       .select()
//       .single();

//     if (updateError) {
//       console.error("Supabase update error:", updateError);
//       return res.status(500).json({
//         success: false,
//         message: "Failed to update user role",
//         error: updateError.message,
//       });
//     }

//     // Return success response
//     res.status(200).json({
//       success: true,
//       message: "User role updated successfully",
//       data: {
//         email: updatedUser.email,
//         name: updatedUser.name,
//         role: updatedUser.role,
//         grade: updatedUser.grade,
//         school_name: updatedUser.school_name,
//         user_id: updatedUser.user_id,
//       },
//     });
//   } catch (error) {
//     console.error("AdminChangeUserRole error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

// controller.AdminDeleteUser = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const adminUser = req.user; // From authenticate middleware

//     // Prevent admin from deleting themselves
//     if (userId === adminUser.id) {
//       return res.status(403).json({
//         success: false,
//         message: "Cannot delete your own account",
//       });
//     }

//     // FIRST: Check if user exists in profiles (before any deletion)
//     const { data: existingUser, error: fetchError } = await supabase
//       .from("profiles")
//       .select("*")
//       .eq("user_id", userId)
//       .single();

//     if (fetchError || !existingUser) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found in profiles",
//       });
//     }

//     // SECOND: Check if auth user exists
//     const { data: authUser, error: authFetchError } =
//       await supabase.auth.admin.getUserById(userId);

//     if (authFetchError || !authUser.user) {
//       return res.status(404).json({
//         success: false,
//         message: "Auth user not found",
//         error: authFetchError?.message,
//       });
//     }

//     // THIRD: Delete the auth user
//     const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
//       userId
//     );

//     if (authDeleteError) {
//       console.error("Auth delete error:", authDeleteError);
//       return res.status(500).json({
//         success: false,
//         message: "Failed to delete auth user",
//         error: authDeleteError.message,
//       });
//     }

//     // FOURTH: Delete user profile
//     const { error: deleteError } = await supabase
//       .from("profiles")
//       .delete()
//       .eq("user_id", userId);

//     if (deleteError) {
//       console.error("Supabase delete error:", deleteError);
//       // Note: Auth user is already deleted, but profile deletion failed
//       return res.status(500).json({
//         success: false,
//         message: "Auth user deleted but failed to delete profile",
//         error: deleteError.message,
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "User deleted successfully",
//       deletedUserId: userId,
//       deletedUserEmail: existingUser.email,
//     });
//   } catch (error) {
//     console.error("AdminDeleteUser error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

controller.testingauth = (req, res) => {
  res.json({ message: "Testing auth route" });
};

module.exports = controller;
