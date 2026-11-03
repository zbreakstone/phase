import { Suspense } from "react";
import { PaletteApp } from "@/components/palette/palette-app";

async function SavedPaletteApp({ params }: { params: PageProps<"/p/[id]">["params"] }) {
  const { id } = await params;
  return <PaletteApp paletteId={id} />;
}

// params resolve at request time, so they're read inside Suspense and the rest of the page can prerender.
export default function SavedPalette(props: PageProps<"/p/[id]">) {
  return (
    <Suspense>
      <SavedPaletteApp params={props.params} />
    </Suspense>
  );
}
