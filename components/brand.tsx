import Image from 'next/image';

type BrandProps = {
  light?: boolean;
  black?: boolean;
  peach?: boolean;
};

export function Brand({ light = false, black = false, peach = false }: BrandProps) {
  const source = light
    ? '/img/logo-white.png'
    : peach
      ? '/img/logo-peach.png'
      : '/img/logo-carbon.png';

  return (
    <span className={`brand${light ? ' brand--light' : ''}${black ? ' brand--black' : ''}`}>
      <Image
        className="brand__logo"
        src={source}
        alt="Pilates House - Hot Pilates"
        width={6000}
        height={1084}
        priority
      />
    </span>
  );
}
