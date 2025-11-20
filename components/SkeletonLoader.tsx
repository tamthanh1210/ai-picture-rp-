import React from 'react';

const SkeletonLoader: React.FC = () => {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/30 dark:bg-slate-900/30 z-10 backdrop-blur-sm">
            <div className="w-full h-full bg-slate-300/40 dark:bg-slate-700/40 animate-pulse"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-violet-500"></div>
                <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">
                    AI đang sáng tạo...
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Quá trình này có thể mất một chút thời gian.
                </p>
            </div>
        </div>
    );
};

export default SkeletonLoader;
