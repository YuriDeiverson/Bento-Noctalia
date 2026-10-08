interface Props {
  tamanho?: number;
}

export function LogoBento({ tamanho = 28 }: Props) {
  return (
    <img
      src="/logobg.png"
      width={tamanho}
      height={tamanho}
      alt=""
      aria-hidden="true"
      style={{ flex: "0 0 auto", objectFit: "contain" }}
    />
  );
}
