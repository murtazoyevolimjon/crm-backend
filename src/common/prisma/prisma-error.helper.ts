import { Prisma } from '@prisma/client';

const getTargetFields = (target: unknown): string[] => {
    if (Array.isArray(target)) {
        return target.filter((item): item is string => typeof item === 'string');
    }

    if (typeof target === 'string') {
        return [target];
    }

    return [];
};

export const isPrismaUniqueConstraintError = (error: unknown, field?: string): boolean => {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        return false;
    }

    if (error.code !== 'P2002') {
        return false;
    }

    if (!field) {
        return true;
    }

    const targetFields = getTargetFields(error.meta?.target);
    return targetFields.includes(field);
};
