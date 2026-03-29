import { Router } from "express";
import { authMiddleware } from "../../middleware/auth-middleware.js";
import { requireRoles } from "../../middleware/role-middleware.js";
import { UserController } from "./user.controller.js";
import { UserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";

const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

export const adminRouter = Router();

adminRouter.use(authMiddleware, requireRoles(["admin"]));

adminRouter.get("/users", userController.listUsersAdmin);
adminRouter.patch("/users/:userId/role", userController.patchUserRoleAdmin);
