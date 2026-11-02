import { ApiError } from "@/lib/api/client"
import { wait } from "@/lib/demo"

export const demoAccount = {
  /** The old password "wrong" shows the error state, like demo sign-in. */
  changePassword: async (oldPassword: string) => {
    await wait(null)
    if (oldPassword.trim().toLowerCase() === "wrong") {
      throw new ApiError("Your old password is incorrect.", 400, {
        message: "Your old password is incorrect.",
      })
    }
    return { message: "Password updated." }
  },
}
