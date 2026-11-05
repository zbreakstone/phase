"use client";

import {
  ColorPicker as ArkColorPicker,
  parseColor as parseColorArk,
} from "@ark-ui/react/color-picker";
import { Portal } from "@ark-ui/react/portal";
import type React from "react";
import { cn } from "@/lib/utils";

export const parseColor = parseColorArk;

/** A stable object: a new one each render makes the popover restart its positioning before it finishes. */
const DEFAULT_POSITIONING = { placement: "bottom-end" } as const;

export interface ColorPickerProps
  extends Omit<React.ComponentProps<typeof ArkColorPicker.Root>, "defaultValue" | "value"> {
  defaultValue?: string;
  value?: string;
}

export const ColorPicker = (props: ColorPickerProps) => {
  const {
    value,
    defaultValue,
    positioning = DEFAULT_POSITIONING,
    lazyMount = true,
    unmountOnExit = true,
    className,
    children,
    ...rest
  } = props;

  return (
    <ArkColorPicker.Root
      className={cn("group/color-picker flex w-full gap-2", className)}
      data-slot="color-picker"
      defaultValue={defaultValue ? parseColor(defaultValue) : undefined}
      lazyMount={lazyMount}
      positioning={positioning}
      unmountOnExit={unmountOnExit}
      value={value === undefined ? undefined : parseColor(value)}
      {...rest}
    >
      {children}
      <ArkColorPicker.HiddenInput aria-hidden="true" />
    </ArkColorPicker.Root>
  );
};

export const ColorPickerControl = (props: React.ComponentProps<typeof ArkColorPicker.Control>) => {
  const { className, ...rest } = props;
  return (
    <ArkColorPicker.Control
      className={cn("flex w-full flex-row items-center gap-2", className)}
      data-slot="color-picker-control"
      {...rest}
    />
  );
};

export const ColorPickerTrigger = (props: React.ComponentProps<typeof ArkColorPicker.Trigger>) => (
  <ArkColorPicker.Trigger data-slot="color-picker-trigger" {...props} />
);

export const ColorPickerContent = (props: React.ComponentProps<typeof ArkColorPicker.Content>) => {
  const { className, ...rest } = props;
  return (
    <Portal>
      <ArkColorPicker.Positioner data-slot="color-picker-positioner">
        <ArkColorPicker.Content
          className={cn(
            "z-50 flex w-64 flex-col gap-3 p-3",
            "rounded-lg bg-popover text-popover-foreground shadow-(--shadow-large)",
            "origin-(--transform-origin) outline-none",
            "data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in",
            "data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out",
            "motion-reduce:animate-none!",
            className,
          )}
          data-slot="color-picker-content"
          {...rest}
        />
      </ArkColorPicker.Positioner>
    </Portal>
  );
};

export const ColorPickerView = (props: React.ComponentProps<typeof ArkColorPicker.View>) => {
  const { className, ...rest } = props;
  return (
    <ArkColorPicker.View
      className={cn("flex w-full flex-col gap-3", className)}
      data-slot="color-picker-view"
      {...rest}
    />
  );
};

export const ColorPickerSlider = (props: React.ComponentProps<typeof ArkColorPicker.ChannelSlider>) => {
  const { className, children, ...rest } = props;
  return (
    <ArkColorPicker.ChannelSlider
      className={cn(
        "relative flex touch-none items-center select-none",
        "data-[orientation=horizontal]:h-4 data-[orientation=horizontal]:w-full",
        className,
      )}
      data-slot="color-picker-channel-slider"
      {...rest}
    >
      {children}
      <ArkColorPicker.ChannelSliderTrack
        className="h-4 w-full grow overflow-hidden rounded-full shadow-(--shadow-default)"
        data-slot="color-picker-channel-slider-track"
      />
      <ArkColorPicker.ChannelSliderThumb
        className={cn(
          "relative size-4 shrink-0 -translate-1/2 rounded-full",
          "border-2 border-white bg-white shadow-(--shadow-default)",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        data-slot="color-picker-channel-slider-thumb"
      />
    </ArkColorPicker.ChannelSlider>
  );
};

export const ColorPickerArea = (props: React.ComponentProps<typeof ArkColorPicker.Area>) => {
  const { className, children, ...rest } = props;
  return (
    <ArkColorPicker.Area
      className={cn("relative h-40 w-full touch-none overflow-hidden rounded-md ring-1 ring-foreground/10 ring-inset", className)}
      data-slot="color-picker-area"
      {...rest}
    >
      <ArkColorPicker.AreaBackground className="size-full rounded-[inherit]" data-slot="color-picker-area-background" />
      {children}
    </ArkColorPicker.Area>
  );
};

export const ColorPickerAreaThumb = (props: React.ComponentProps<typeof ArkColorPicker.AreaThumb>) => {
  const { className, ...rest } = props;
  return (
    <ArkColorPicker.AreaThumb
      className={cn("size-4 rounded-full border-2 border-white shadow-(--shadow-default) outline-none", className)}
      data-slot="color-picker-area-thumb"
      {...rest}
    />
  );
};

export const ColorPickerInput = (props: Partial<React.ComponentProps<typeof ArkColorPicker.ChannelInput>>) => {
  const { channel = "hex", ...rest } = props;
  return <ArkColorPicker.ChannelInput channel={channel} data-slot="color-picker-input" {...rest} />;
};
