import { Link } from 'react-router-dom';
import { SynozaLogo } from '../SynozaLogo';

export function LandingBrandLogo({ onClick }: { onClick?: () => void }) {
  return <SynozaLogo height={60} to="/" onClick={onClick} />;
}
