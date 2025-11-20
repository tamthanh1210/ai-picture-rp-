import React from 'react';
import { InfoIcon } from './Icons';

interface ErrorDisplayProps {
    message: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message }) => {
    return (
        <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="flex flex-col items-center justify-center text-center bg-red-100/50 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-6 rounded-xl border border-red-200 dark:border-red-500/30 shadow-lg">
                <InfoIcon />
                <p className="mt-2 font-semibold">Đã xảy ra lỗi</p>
                <p className="text-sm">{message}</p>
            </div>
        </div>
    );
};

export default ErrorDisplay;
