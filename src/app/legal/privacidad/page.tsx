export const metadata = { title: "Política de Privacidad · AuraFood" };

const UPDATED = "10 de junio de 2026";

export default function PrivacidadPage() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-foreground">
      <div>
        <h1 className="font-display text-3xl font-medium text-primary mb-1">
          Política de Privacidad
        </h1>
        <p className="text-xs text-muted-foreground">
          Última actualización: {UPDATED}
        </p>
      </div>

      <p className="text-muted-foreground">
        ⚠️ Plantilla base. Adáptala con asesoría legal a tu jurisdicción y a la
        normativa de protección de datos que te aplique.
      </p>

      <Section title="1. Datos que recopilamos">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>De los dueños/staff:</strong> nombre, email, contraseña (cifrada), rol.</li>
          <li><strong>Del restaurante:</strong> nombre, logo, dirección, datos fiscales, productos, ventas, inventario.</li>
          <li><strong>De clientes finales (pedidos QR):</strong> nombre, teléfono y mesa, solo si los proporcionan al pedir.</li>
          <li><strong>Técnicos:</strong> cookies de sesión necesarias para el inicio de sesión y el contexto del restaurante.</li>
        </ul>
      </Section>

      <Section title="2. Para qué los usamos">
        Para prestar el Servicio: autenticación, mostrar el menú, procesar pedidos,
        generar reportes, y dar soporte. No vendemos tus datos.
      </Section>

      <Section title="3. Cookies">
        Usamos cookies estrictamente necesarias para la sesión y para identificar el
        restaurante (slug/tenant). No usamos cookies publicitarias de terceros.
      </Section>

      <Section title="4. Proveedores">
        Nos apoyamos en proveedores de infraestructura como Supabase (base de datos
        y autenticación) y Vercel (hosting). Tus datos se procesan en sus
        servidores conforme a sus propias políticas.
      </Section>

      <Section title="5. Conservación">
        Conservamos los datos mientras tu cuenta esté activa. Si cancelas, podemos
        conservar cierta información por obligaciones legales o contables durante el
        plazo que la ley requiera.
      </Section>

      <Section title="6. Tus derechos">
        Puedes solicitar acceso, rectificación o eliminación de tus datos personales
        escribiendo a <span className="font-mono">privacidad@tu-dominio.com</span>.
        Los clientes finales deben dirigir sus solicitudes al restaurante
        correspondiente, que es el responsable de esos datos.
      </Section>

      <Section title="7. Seguridad">
        Aplicamos medidas razonables (cifrado en tránsito, aislamiento por
        restaurante mediante reglas de acceso a nivel de fila) para proteger tu
        información. Ningún sistema es 100% infalible.
      </Section>

      <Section title="8. Cambios">
        Podemos actualizar esta Política. Publicaremos la versión vigente con su
        fecha de actualización.
      </Section>

      <Section title="9. Contacto">
        Dudas de privacidad:{" "}
        <span className="font-mono">privacidad@tu-dominio.com</span>.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-base mb-1">{title}</h2>
      <div className="text-muted-foreground">{children}</div>
    </section>
  );
}
