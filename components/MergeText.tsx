// Shows copy the way a person reads it: [FIRST NAME] and [LINK] are not
// mistakes, they're fill-ins the email tool swaps for each reader, so they
// show as small tags instead of raw brackets. The saved text is unchanged.
const TAG = /(\[FIRST NAME\]|\[LINK\])/g;

export function MergeText({ text }: { text: string }) {
  const parts = text.split(TAG);
  return (
    <>
      {parts.map((part, i) =>
        part === "[FIRST NAME]" || part === "[LINK]" ? (
          <span
            key={i}
            title={part === "[LINK]" ? "Your link goes here" : "Each reader's first name"}
            className="inline-block align-baseline px-1.5 mx-px rounded-md bg-[#F1EAFD] text-[#5B21B6] text-[0.85em] font-semibold leading-[1.4]"
          >
            {part === "[LINK]" ? "link" : "First name"}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
