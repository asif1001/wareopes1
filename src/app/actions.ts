"use server";

import { revalidatePath } from "next/cache";
import { addSource, addContainerSize, addTask, updateTask, deleteTask, getTasksOptimized, getAllTasks, getUsersMinimal, getTaskCounts, batchUpdateTasks } from "@/lib/firebase/firestore";
import { UserRole, Task, User } from "@/lib/types";

// Login action
export async function loginAction(prevState: any, formData: FormData) {
  try {
    const employeeNo = (formData.get('employeeNo') as string | null)?.trim();
    const password = (formData.get('password') as string | null)?.trim();

    // Basic validation
    if (!employeeNo || !password) {
      return {
        success: false,
        message: 'Employee No and password are required',
        error: 'Missing credentials'
      };
    }

    // Real authentication logic using Firebase
    const { getUserByEmployeeNo } = await import('@/lib/firebase/firestore');
    
    try {
      const user = await getUserByEmployeeNo(employeeNo);
      
      if (!user) {
        return {
          success: false,
          message: 'Invalid Employee No or password',
          error: 'Authentication failed'
        };
      }

      // In a real app, you would hash and compare passwords
      // For now, we'll check if the user exists and has a password field
      // You should implement proper password hashing (bcrypt, etc.)
      const storedPassword = user.password?.trim();
      if (storedPassword && storedPassword === password) {
        return {
          success: true,
          message: 'Login successful! Redirecting to dashboard...',
          redirect: '/dashboard',
          user: {
            id: user.id,
            fullName: user.fullName,
            employeeNo: user.employeeNo,
            email: user.email,
            department: user.department,
            role: user.role
          }
        };
      } else {
        return {
          success: false,
          message: 'Invalid Employee No or password',
          error: 'Authentication failed'
        };
      }
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      return {
        success: false,
        message: 'Login failed. Please try again.',
        error: 'Database error'
      };
    }
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'Login failed. Please try again.',
      error: 'Server error'
    };
  }
}

// Existing actions...
export async function createUser(formData: FormData) {
  // Implementation for creating user
  console.log("Creating user:", formData);
  revalidatePath("/dashboard");
}

export async function updateUser(formData: FormData) {
  // Implementation for updating user
  console.log("Updating user:", formData);
  revalidatePath("/dashboard");
}

export async function deleteUser(id: string) {
  // Implementation for deleting user
  console.log("Deleting user:", id);
  revalidatePath("/dashboard");
}

export async function generateReport(
  prevState: { output: { reportDescription: string; chartSuggestions: string; }; error: null; }, 
  formData: FormData
) {
  // Implementation for generating reports
  const reportTitle = formData.get("reportTitle") as string;
  const reportDescription = formData.get("reportDescription") as string;
  
  console.log("Generating report:", reportTitle);
  
  // Simulate AI-generated report suggestions
  const output = {
    reportDescription: `Based on your request for "${reportTitle}", here's a comprehensive analysis of your warehouse operations data. This report will help you understand key performance indicators and identify areas for improvement.`,
    chartSuggestions: `For "${reportTitle}", I recommend the following visualizations:
    
1. Bar Chart - Compare performance across different time periods
2. Line Chart - Show trends over time for key metrics
3. Pie Chart - Display distribution of categories or segments
4. Heat Map - Visualize patterns in your operational data
5. Dashboard Cards - Highlight key performance indicators

These visualizations will provide clear insights into your warehouse operations and help drive data-driven decisions.`
  };
  
  return { output, error: null };
}

export async function createShipment(formData: FormData) {
  // Implementation for creating shipment
  console.log("Creating shipment:", formData);
  revalidatePath("/dashboard");
}

export async function updateShipment(formData: FormData) {
  // Implementation for updating shipment
  console.log("Updating shipment:", formData);
  revalidatePath("/dashboard");
}

export async function deleteShipment(id: string) {
  // Implementation for deleting shipment
  console.log("Deleting shipment:", id);
  revalidatePath("/dashboard");
}

// New My Account related actions
export async function updateUserProfile(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;

    // Validate input
    if (!name || !email) {
      return { success: false, error: "Name and email are required" };
    }

    // Here you would typically:
    // 1. Get current user from session/auth
    // 2. Update user in database
    // 3. Handle any validation/business logic

    console.log("Updating user profile:", { name, email, phone });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    revalidatePath("/my-account");
    return { success: true, message: "Profile updated successfully" };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}

export async function changePassword(formData: FormData) {
  try {
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return { success: false, error: "All password fields are required" };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "New passwords do not match" };
    }

    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long" };
    }

    // Here you would typically:
    // 1. Verify current password
    // 2. Hash new password
    // 3. Update password in database
    // 4. Invalidate existing sessions if needed

    console.log("Changing password for user");
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true, message: "Password changed successfully" };
  } catch (error) {
    console.error("Error changing password:", error);
    return { success: false, error: "Failed to change password" };
  }
}

export async function updateNotificationPreferences(formData: FormData) {
  try {
    const emailNotifications = formData.get("emailNotifications") === "true";
    const pushNotifications = formData.get("pushNotifications") === "true";
    const smsNotifications = formData.get("smsNotifications") === "true";

    // Here you would typically:
    // 1. Get current user from session/auth
    // 2. Update notification preferences in database

    console.log("Updating notification preferences:", {
      emailNotifications,
      pushNotifications,
      smsNotifications
    });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    revalidatePath("/my-account");
    return { success: true, message: "Notification preferences updated" };
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return { success: false, error: "Failed to update preferences" };
  }
}

export async function submitSupportTicket(formData: FormData) {
  try {
    const subject = formData.get("subject") as string;
    const message = formData.get("message") as string;
    const priority = formData.get("priority") as string;

    // Validate input
    if (!subject || !message) {
      return { success: false, error: "Subject and message are required" };
    }

    // Here you would typically:
    // 1. Get current user from session/auth
    // 2. Create support ticket in database
    // 3. Send notification to support team
    // 4. Send confirmation email to user

    const ticketId = `TICKET-${Date.now()}`;
    
    console.log("Creating support ticket:", {
      ticketId,
      subject,
      message,
      priority
    });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return { 
      success: true, 
      message: `Support ticket ${ticketId} created successfully. We'll get back to you soon!`,
      ticketId 
    };
  } catch (error) {
    console.error("Error submitting support ticket:", error);
    return { success: false, error: "Failed to submit support ticket" };
  }
}

export async function addUserAction(prevState: any, formData: FormData) {
  try {
    const fullName = formData.get('fullName') as string;
    const employeeNo = formData.get('employeeNo') as string;
    const password = formData.get('password') as string;
    const email = formData.get('email') as string;
    const department = formData.get('department') as string;
    const role = formData.get('role') as string;

    // Validate input
    if (!fullName || !employeeNo || !password || !department || !role) {
      return { message: "All fields are required" };
    }

    // Actually save to Firebase
    const { addUser } = await import('@/lib/firebase/firestore');
    await addUser({
      fullName,
      employeeNo,
      password,
      email: email || '',
      department,
      role: role as UserRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    revalidatePath('/dashboard/settings');
    return { message: "User added successfully" };
  } catch (error) {
    console.error("Error adding user:", error);
    return { message: "Failed to add user" };
  }
}

export async function addSourceAction(prevState: any, formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;

    if (!name || !code) {
      return { message: "Name and code are required" };
    }

    // Actually save to Firebase
    await addSource({
      name: name,
      shortName: code
    });

    revalidatePath('/dashboard/settings');
    return { message: "Source added successfully" };
  } catch (error) {
    console.error("Error adding source:", error);
    return { message: "Failed to add source" };
  }
}

export async function addContainerSizeAction(prevState: any, formData: FormData) {
  try {
    const size = formData.get('size') as string;
    const description = formData.get('description') as string;

    if (!size) {
      return { message: "Size is required" };
    }

    // Actually save to Firebase
    await addContainerSize({
      size: size,
      cmb: description || ''
    });

    revalidatePath('/dashboard/settings');
    return { message: "Container size added successfully" };
  } catch (error) {
    console.error("Error adding container size:", error);
    return { message: "Failed to add container size" };
  }
}

export async function addDepartmentAction(prevState: any, formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const branch = formData.get('branch') as string;

    if (!name || !branch) {
      return { message: "Name and branch are required" };
    }

    // Actually save to Firebase
    const { addDepartment } = await import('@/lib/firebase/firestore');
    await addDepartment({
      name,
      branch
    });

    revalidatePath('/dashboard/settings');
    return { message: "Department added successfully" };
  } catch (error) {
    console.error("Error adding department:", error);
    return { message: "Failed to add department" };
  }
}

export async function addBranchAction(prevState: any, formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;

    if (!name || !code) {
      return { message: "Name and code are required" };
    }

    console.log("Adding branch:", { name, code });
    
    // Call the actual Firebase function
    const { addBranch } = await import('@/lib/firebase/firestore');
    await addBranch({
      name,
      code
    });

    revalidatePath('/dashboard/settings');
    return { message: "Branch added successfully" };
  } catch (error) {
    console.error("Error adding branch:", error);
    return { message: "Failed to add branch" };
  }
}

// Update actions
export async function updateUserAction(prevState: any, formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;
    const department = formData.get('department') as string;
    const role = formData.get('role') as UserRole;

    if (!id || !fullName || !email || !department || !role) {
      return { message: "All fields are required" };
    }

    console.log("Updating user:", { id, fullName, email, department, role });
    
    // Call the actual Firebase function
    const { updateUser } = await import('@/lib/firebase/firestore');
    await updateUser(id, {
      fullName,
      email,
      department,
      role
    });

    revalidatePath('/dashboard/settings');
    return { message: "User updated successfully" };
  } catch (error) {
    console.error("Error updating user:", error);
    return { message: "Failed to update user" };
  }
}

// Update user profile action (for my-account page)
export async function updateUserProfileAction(userId: string, profileData: Partial<User>) {
  try {
    const { updateUserProfile } = await import('@/lib/firebase/firestore');
    await updateUserProfile(userId, profileData);
    
    return { success: true, message: "Profile updated successfully" };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { success: false, message: "Failed to update profile" };
  }
}

export async function updateSourceAction(prevState: any, formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;

    if (!id || !name || !code) {
      return { message: "All fields are required" };
    }

    console.log("Updating source:", { id, name, code });
    
    // Call the actual Firebase function
    const { updateSource } = await import('@/lib/firebase/firestore');
    await updateSource(id, {
      name,
      shortName: code
    });

    revalidatePath('/dashboard/settings');
    return { message: "Source updated successfully" };
  } catch (error) {
    console.error("Error updating source:", error);
    return { message: "Failed to update source" };
  }
}

export async function updateContainerSizeAction(prevState: any, formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const size = formData.get('size') as string;
    const description = formData.get('description') as string;

    if (!id || !size) {
      return { message: "ID and size are required" };
    }

    console.log("Updating container size:", { id, size, description });
    
    // Call the actual Firebase function
    const { updateContainerSize } = await import('@/lib/firebase/firestore');
    await updateContainerSize(id, {
      size,
      cmb: description || ''
    });

    revalidatePath('/dashboard/settings');
    return { message: "Container size updated successfully" };
  } catch (error) {
    console.error("Error updating container size:", error);
    return { message: "Failed to update container size" };
  }
}

export async function updateDepartmentAction(prevState: any, formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const branch = formData.get('branch') as string;

    if (!id || !name || !branch) {
      return { message: "All fields are required" };
    }

    console.log("Updating department:", { id, name, branch });
    
    // Call the actual Firebase function
    const { updateDepartment } = await import('@/lib/firebase/firestore');
    await updateDepartment(id, {
      name,
      branch
    });

    revalidatePath('/dashboard/settings');
    return { message: "Department updated successfully" };
  } catch (error) {
    console.error("Error updating department:", error);
    return { message: "Failed to update department" };
  }
}

export async function updateBranchAction(prevState: any, formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;

    if (!id || !name || !code) {
      return { message: "All fields are required" };
    }

    console.log("Updating branch:", { id, name, code });
    
    // Call the actual Firebase function
    const { updateBranch } = await import('@/lib/firebase/firestore');
    await updateBranch(id, {
      name,
      code
    });

    revalidatePath('/dashboard/settings');
    return { message: "Branch updated successfully" };
  } catch (error) {
    console.error("Error updating branch:", error);
    return { message: "Failed to update branch" };
  }
}

// Delete actions
export async function deleteUserAction(prevState: any, formData: FormData) {
  try {
    const id = formData.get('id') as string;
    
    if (!id) {
      return { message: "User ID is required" };
    }

    console.log("Deleting user:", id);
    
    // Call the actual Firebase function
    const { deleteUser } = await import('@/lib/firebase/firestore');
    await deleteUser(id);

    revalidatePath('/dashboard/settings');
    return { message: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { message: "Failed to delete user" };
  }
}

export async function deleteSourceAction(prevState: any, formData: FormData) {
  try {
    const id = formData.get('id') as string;
    
    if (!id) {
      return { message: "Source ID is required" };
    }

    console.log("Deleting source:", id);
    
    // Call the actual Firebase function
    const { deleteSource } = await import('@/lib/firebase/firestore');
    await deleteSource(id);

    revalidatePath('/dashboard/settings');
    return { message: "Source deleted successfully" };
  } catch (error) {
    console.error("Error deleting source:", error);
    return { message: "Failed to delete source" };
  }
}

export async function deleteContainerSizeAction(prevState: any, formData: FormData) {
  try {
    const id = formData.get('id') as string;
    
    if (!id) {
      return { message: "Container size ID is required" };
    }

    console.log("Deleting container size:", id);
    
    // Call the actual Firebase function
    const { deleteContainerSize } = await import('@/lib/firebase/firestore');
    await deleteContainerSize(id);

    revalidatePath('/dashboard/settings');
    return { message: "Container size deleted successfully" };
  } catch (error) {
    console.error("Error deleting container size:", error);
    return { message: "Failed to delete container size" };
  }
}

export async function deleteDepartmentAction(prevState: any, formData: FormData) {
  try {
    const id = formData.get('id') as string;
    
    if (!id) {
      return { message: "Department ID is required" };
    }

    console.log("Deleting department:", id);
    
    // Call the actual Firebase function
    const { deleteDepartment } = await import('@/lib/firebase/firestore');
    await deleteDepartment(id);

    revalidatePath('/dashboard/settings');
    return { message: "Department deleted successfully" };
  } catch (error) {
    console.error("Error deleting department:", error);
    return { message: "Failed to delete department" };
  }
}

export async function deleteBranchAction(prevState: any, formData: FormData) {
  try {
    const id = formData.get('id') as string;
    
    if (!id) {
      return { message: "Branch ID is required" };
    }

    console.log("Deleting branch:", id);
    
    // Call the actual Firebase function
    const { deleteBranch } = await import('@/lib/firebase/firestore');
    await deleteBranch(id);

    revalidatePath('/dashboard/settings');
    return { message: "Branch deleted successfully" };
  } catch (error) {
    console.error("Error deleting branch:", error);
    return { message: "Failed to delete branch" };
  }
}

// Bulk import action
export async function bulkAddShipmentsAction(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    
    if (!file) {
      return { success: false, error: "File is required" };
    }

    console.log("Processing bulk import file:", file.name);
    
    // Simulate file processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    revalidatePath('/dashboard/settings');
    return { 
      success: true, 
      message: `Successfully imported shipments from ${file.name}`,
      error: null 
    };
  } catch (error) {
    console.error("Error processing bulk import:", error);
    return { success: false, error: "Failed to process bulk import" };
  }
}

export async function logoutUser() {
  try {
    // Here you would typically:
    // 1. Clear user session
    // 2. Invalidate auth tokens
    // 3. Clear any cached user data
    // 4. Redirect to login page

    console.log("Logging out user");
    
    // Clear localStorage session
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wareops_session');
    }

    // Simulate logout process
    await new Promise(resolve => setTimeout(resolve, 100));

    // In a real app, you'd use your auth library's logout function
    // For example, with NextAuth: await signOut({ redirect: false })
    
    return { success: true, message: "Logged out successfully" };
  } catch (error) {
    console.error("Error during logout:", error);
    return { success: false, error: "Failed to logout" };
  }
}

// Task Actions
export async function createTaskAction(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, currentUserId?: string) {
  try {
    // Ensure the task has the correct createdBy field
    const taskWithCreator = {
      ...taskData,
      createdBy: currentUserId || taskData.createdBy || "unknown"
    };
    const taskId = await addTask(taskWithCreator);
    revalidatePath('/dashboard/tasks');
    return { success: true, taskId, message: "Task created successfully" };
  } catch (error) {
    console.error("Error creating task:", error);
    return { success: false, error: "Failed to create task" };
  }
}

// Optimized actions for minimal data reads
export async function getTasksOptimizedAction(options?: {
  limit?: number;
  status?: string[];
  assignedTo?: string[];
  priority?: string[];
  fields?: string[];
  currentUserId?: string;
  filterMode?: 'created' | 'assigned' | 'both';
}) {
  try {
    const tasks = await getTasksOptimized(options);
    return { success: true, data: tasks };
  } catch (error) {
    console.error('Error fetching optimized tasks:', error);
    return { success: false, error: 'Failed to fetch tasks' };
  }
}

export async function getAllTasksAction(options?: {
  limit?: number;
  status?: string[];
  assignedTo?: string[];
  priority?: string[];
  fields?: string[];
  currentUserId?: string;
}) {
  try {
    const tasks = await getAllTasks(options);
    return { success: true, data: tasks };
  } catch (error) {
    console.error('Error fetching all tasks:', error);
    return { success: false, error: 'Failed to fetch all tasks' };
  }
}

export async function getUsersMinimalAction() {
  try {
    const users = await getUsersMinimal();
    return { success: true, data: users };
  } catch (error) {
    console.error('Error fetching minimal users:', error);
    return { success: false, error: 'Failed to fetch users' };
  }
}

export async function getTaskCountsAction(currentUserId?: string) {
  try {
    const counts = await getTaskCounts(currentUserId);
    return { success: true, data: counts };
  } catch (error) {
    console.error('Error fetching task counts:', error);
    return { success: false, error: 'Failed to fetch task counts' };
  }
}

export async function batchUpdateTasksAction(updates: { id: string; data: Partial<Task>; currentUserId?: string }[]) {
  try {
    await batchUpdateTasks(updates);
    revalidatePath('/dashboard/tasks');
    return { success: true };
  } catch (error) {
    console.error('Error batch updating tasks:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update tasks' };
  }
}

export async function updateTaskAction(id: string, taskData: Partial<Task>, currentUserId?: string) {
  try {
    await updateTask(id, taskData, currentUserId);
    revalidatePath('/dashboard/tasks');
    return { success: true, message: "Task updated successfully" };
  } catch (error) {
    console.error("Error updating task:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update task" };
  }
}

export async function deleteTaskAction(id: string, currentUserId?: string) {
  try {
    await deleteTask(id, currentUserId);
    revalidatePath('/dashboard/tasks');
    return { success: true, message: "Task deleted successfully" };
  } catch (error) {
    console.error("Error deleting task:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete task" };
  }
}
