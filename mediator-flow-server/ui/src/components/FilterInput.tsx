interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function FilterInput({ value, onChange, placeholder = 'Filter by name...', className = '' }: Props) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm text-gray-300 outline-none w-48 placeholder-gray-600"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-gray-500 hover:text-gray-300 text-xs"
        >
          Clear
        </button>
      )}
    </div>
  );
}
