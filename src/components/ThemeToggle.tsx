import { useTheme } from "../contexts/ThemeContext";

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle = ({ className }: ThemeToggleProps) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={className}
      aria-label="Toggle dark mode"
      style={
        className
          ? undefined
          : {
              width: 36, height: 36, borderRadius: "50%",
              border: "1.5px dashed var(--ink)",
              background: "transparent", color: "var(--ink)",
              fontFamily: "'Caveat', cursive", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }
      }
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
};
