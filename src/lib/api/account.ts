import { apiRequest } from "@/lib/api/client"

/**
 * Change password while signed in: POST reset_password/ with the bearer
 * token (old redux/actions/auth/auth.action.js:77-86). Not the logged-out
 * "forgot password" flow under accounts/. Errors carry `message`, which the
 * client surfaces as the ApiError message.
 */
export const changePassword = (
  username: string,
  oldPassword: string,
  newPassword: string
) =>
  apiRequest<{ message?: string }>("reset_password/", {
    method: "POST",
    body: { username, password: oldPassword, new_password: newPassword },
  })
