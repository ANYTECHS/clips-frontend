export type ApiResponse<T> = {
    data: T | null;
    error: string | null;
    code?: string;
};

