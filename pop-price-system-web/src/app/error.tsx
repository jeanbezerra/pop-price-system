"use client";

import {
  Button,
  Card,
  Text,
  makeStyles,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import { FluentRegistry } from "@/components/fluent-registry";

const useStyles = makeStyles({
  main: { padding: tokens.spacingHorizontalXXXL },
  title: { ...typographyStyles.title1, margin: 0 },
});

function ErrorContent({ reset }: { reset: () => void }) {
  const styles = useStyles();
  return (
    <main className={styles.main}>
      <Card>
        <h1 className={styles.title}>Não foi possível abrir esta página</h1>
        <Text>Tente carregar novamente para continuar.</Text>
        <Button onClick={reset} appearance="primary">
          Tentar novamente
        </Button>
      </Card>
    </main>
  );
}

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <FluentRegistry>
      <ErrorContent reset={reset} />
    </FluentRegistry>
  );
}
