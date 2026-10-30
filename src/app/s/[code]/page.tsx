import { Suspense } from "react";
import { PaletteApp } from "@/components/palette/palette-app";

async function SharedPaletteApp({ params }: { params: PageProps<"/s/[code]">["params"] }) {
  const { code } = await params;
  return <PaletteApp shareCode={code} />;
}

// params resolve at request time, so they're read inside Suspense and the rest of the page can prerender.
export default function SharedPalette(props: PageProps<"/s/[code]">) {
  return (
    <Suspense>
      <SharedPaletteApp params={props.params} />
    </Suspense>
  );
}
