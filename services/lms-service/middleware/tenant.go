package middleware

import (
	"github.com/gofiber/fiber/v2"
)

func TenantMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if v, ok := c.Locals("tenant_id").(string); ok && v != "" {
			return c.Next()
		}
		tenantID := c.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}
		c.Locals("tenant_id", tenantID)
		return c.Next()
	}
}

func GetTenant(c *fiber.Ctx) string {
	if v, ok := c.Locals("tenant_id").(string); ok {
		return v
	}
	return "default"
}

func GetUserRole(c *fiber.Ctx) string {
	if v, ok := c.Locals("user_role").(string); ok {
		return v
	}
	return "employee"
}

func GetUserID(c *fiber.Ctx) string {
	if v, ok := c.Locals("user_id").(string); ok {
		return v
	}
	return ""
}
