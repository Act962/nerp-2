"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { editorExtensions } from "./extensions";
import { MenuToolbar } from "./menu-toolbar";

interface RichTextEditorProps {
  field?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

function parseContent(raw: string | undefined) {
  if (!raw) return "";
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function RichTextEditor({
  field,
  onChange,
  disabled,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    content: parseContent(field),
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(JSON.stringify(editor.getJSON()));
      }
    },
    extensions: editorExtensions,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "max-w-none min-h-[125px] focus:outline-none p-4 prose dark:prose-invert marker:text-gray-500 prose-p:my-0",
      },
    },
  });

  // Sync editor when field changes from outside (e.g. edit form loading saved data)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const serialized = JSON.stringify(editor.getJSON());
    if (serialized === field) return;
    editor.commands.setContent(parseContent(field));
  }, [editor, field]);

  return (
    <div className="relative w-full border border-input rounded-lg overflow-hidden dark:bg-input/30 flex flex-col">
      <MenuToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="max-h-[200px] overflow-y-auto"
      />
    </div>
  );
}
