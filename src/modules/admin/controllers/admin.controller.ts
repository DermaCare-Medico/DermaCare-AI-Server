import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { listAuditLogs } from "../services/admin.service.js";

const getAdminUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    return userId;
};

const getAuditLogs = async (req: Request, res: Response) => {
    const result = await listAuditLogs(getAdminUserId(req), {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        dateFrom: req.query.dateFrom as unknown as Date | undefined,
        dateTo: req.query.dateTo as unknown as Date | undefined,
        actorUserId: req.query.actorUserId as string | undefined,
        action: req.query.action as string | undefined,
        entityType: req.query.entityType as string | undefined,
        entityId: req.query.entityId as string | undefined,
    });

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Audit logs retrieved successfully",
        data: result.logs,
        pagination: result.pagination,
    });
};

export const adminController = { getAuditLogs };
