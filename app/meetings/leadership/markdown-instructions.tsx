import Markdown from "react-markdown";
export function MarkdownInstructions({ children }: { children: string }) {
  return (
    <div className="break-words text-sm text-muted-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-medium [&_h3]:text-foreground [&_h4]:font-medium [&_h4]:text-foreground [&_h5]:font-medium [&_h5]:text-foreground [&_h6]:font-medium [&_h6]:text-foreground [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown skipHtml>{children}</Markdown>
    </div>
  );
}
