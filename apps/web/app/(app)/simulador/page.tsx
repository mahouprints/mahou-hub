export default function SimuladorPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Simulador</h1>
      <p className="text-sm text-mahou-mute">
        Projeta produção de um produto cadastrado em um período (horas/dia, dias, utilização, nº
        impressoras). A implementar — endpoint <code>POST /api/pricing/simular</code> já está
        pronto.
      </p>
    </div>
  );
}
