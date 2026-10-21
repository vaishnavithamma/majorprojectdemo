export default function Card({
  children,
  className = "",
  style = {},
  ...rest
}) {
  return (
    <div className={`card glass-card ${className}`} style={style} {...rest}>
      {children}
    </div>
  );
}