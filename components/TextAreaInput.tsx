import React, { forwardRef } from 'react';

interface TextAreaInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  rows?: number;
}

const TextAreaInput = forwardRef<HTMLTextAreaElement, TextAreaInputProps>(
  ({ id, label, value, onChange, placeholder, rows = 3 }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          className="w-full p-3 bg-white/50 dark:bg-slate-700/50 border border-violet-300/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all duration-200 resize-y text-gray-800 dark:text-gray-200 placeholder-gray-500"
        />
      </div>
    );
  }
);

TextAreaInput.displayName = 'TextAreaInput';

export default TextAreaInput;