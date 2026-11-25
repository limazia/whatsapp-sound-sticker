import { useMutation } from "@tanstack/react-query";

import { prepareSticker } from "@/features/stickers/http/prepare-sticker";
import { sendSticker } from "@/features/stickers/http/send-sticker";

export function useStickers() {
  return {
    prepareSticker: useMutation({ mutationFn: prepareSticker }),
    sendSticker: useMutation({ mutationFn: sendSticker }),
  };
}
