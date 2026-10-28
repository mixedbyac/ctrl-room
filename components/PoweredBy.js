export default function PoweredBy({ className = '' }) {
  return (
    <a className={`poweredby ${className}`} href="https://art-house.us" target="_blank" rel="noopener noreferrer" aria-label="Powered by arthouse">
      <span>Powered by</span>
      <img src="/arthouse.png" alt="arthouse" width="600" height="114" />
    </a>
  );
}
