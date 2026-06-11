export const metadata = { title: "Términos y Condiciones · AuraFood" };

const UPDATED = "10 de junio de 2026";

export default function TerminosPage() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-foreground">
      <div>
        <h1 className="font-display text-3xl font-medium text-primary mb-1">
          Términos y Condiciones
        </h1>
        <p className="text-xs text-muted-foreground">
          Última actualización: {UPDATED}
        </p>
      </div>

      <p className="text-muted-foreground">
        ⚠️ Esta es una plantilla base. Antes de operar comercialmente y cobrar,
        revísala con un abogado y adáptala a tu jurisdicción (RD / México / etc.).
      </p>

      <Section title="1. Aceptación">
        Al crear una cuenta o usar AuraFood (&quot;el Servicio&quot;), aceptas estos
        Términos. Si no estás de acuerdo, no uses el Servicio.
      </Section>

      <Section title="2. Descripción del Servicio">
        AuraFood es una plataforma SaaS de punto de venta, menú digital por QR,
        gestión de inventario y reportes para restaurantes. El Servicio se ofrece
        &quot;tal cual&quot; y puede cambiar con el tiempo.
      </Section>

      <Section title="3. Cuentas y registro">
        Eres responsable de la veracidad de los datos de tu restaurante, de
        mantener segura tu contraseña y de toda la actividad realizada bajo tu
        cuenta. Debes ser mayor de edad y tener facultades para representar al
        negocio que registras.
      </Section>

      <Section title="4. Período de prueba y pagos">
        El Servicio puede ofrecer un período de prueba gratuito. Al finalizar, el
        acceso puede requerir una suscripción de pago. Los precios, ciclos de
        facturación y métodos de pago se informan en el momento de la contratación.
        Salvo que la ley aplicable disponga lo contrario, los pagos no son
        reembolsables.
      </Section>

      <Section title="5. Uso aceptable">
        No puedes usar el Servicio para actividades ilegales, para vulnerar la
        seguridad de la plataforma, para enviar spam, ni para infringir derechos de
        terceros. Podemos suspender cuentas que incumplan estas reglas.
      </Section>

      <Section title="6. Datos del restaurante y de sus clientes">
        Eres el responsable del tratamiento de los datos de tus clientes finales
        (nombres, teléfonos de pedidos, etc.). AuraFood actúa como encargado del
        tratamiento y procesa esos datos únicamente para prestarte el Servicio.
        Consulta la <a className="text-primary hover:underline" href="/legal/privacidad">Política de Privacidad</a>.
      </Section>

      <Section title="7. Disponibilidad">
        Hacemos esfuerzos razonables por mantener el Servicio disponible, pero no
        garantizamos un funcionamiento ininterrumpido. Podemos realizar
        mantenimientos programados.
      </Section>

      <Section title="8. Limitación de responsabilidad">
        En la máxima medida permitida por la ley, AuraFood no será responsable de
        pérdidas indirectas, lucro cesante, ni de daños derivados del uso o
        imposibilidad de uso del Servicio.
      </Section>

      <Section title="9. Terminación">
        Puedes cancelar tu cuenta cuando quieras. Podemos suspender o cancelar el
        acceso por incumplimiento de estos Términos o falta de pago.
      </Section>

      <Section title="10. Cambios">
        Podemos actualizar estos Términos. Te avisaremos de cambios materiales. El
        uso continuado del Servicio implica la aceptación de la versión vigente.
      </Section>

      <Section title="11. Contacto">
        Para dudas sobre estos Términos, escríbenos a{" "}
        <span className="font-mono">soporte@tu-dominio.com</span>.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-base mb-1">{title}</h2>
      <p className="text-muted-foreground">{children}</p>
    </section>
  );
}
