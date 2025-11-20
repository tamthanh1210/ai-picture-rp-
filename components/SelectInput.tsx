import React from 'react';

interface SelectInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  disabled?: boolean;
}

const SelectInput: React.FC<SelectInputProps> = ({ id, label, value, onChange, options, disabled = false }) => {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="w-full p-3 bg-white/50 dark:bg-slate-700/50 border border-violet-300/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:outline-none transition-all duration-200 appearance-none text-gray-800 dark:text-gray-200 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {options.map((option) => (
            <option key={option} value={option} className="bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200">
              {option}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>
    </div>
  );
};

export default SelectInput;
