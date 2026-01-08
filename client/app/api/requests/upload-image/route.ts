import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

const BUCKET_NAME = "request-media";
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const formData = await req.formData();

    const draftId = formData.get("draft_id");
    const image = (formData.get("image") || formData.get("file")) as
      | File
      | null;

    if (!draftId || typeof draftId !== "string") {
      return NextResponse.json(
        { message: "draft_id is required" },
        { status: 400 }
      );
    }

    if (!image || !(image instanceof File)) {
      return NextResponse.json(
        { message: "image file is required" },
        { status: 400 }
      );
    }

    if (!image.type || !image.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "file must be an image type" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(image.type)) {
      return NextResponse.json(
        { message: "Only JPG and PNG images are allowed" },
        { status: 400 }
      );
    }

    const extensionFromName = image.name.split(".").pop()?.toLowerCase();
    const fileExtension =
      extensionFromName && ["jpg", "jpeg", "png"].includes(extensionFromName)
        ? extensionFromName === "jpeg"
          ? "jpg"
          : extensionFromName
        : image.type === "image/png"
        ? "png"
        : "jpg";

    const filePath = `drafts/${draftId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExtension}`;

    const arrayBuffer = await image.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: image.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[drafts/upload-image] upload failed:", uploadError);
      return NextResponse.json(
        { message: "Failed to upload image", error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      console.error("[drafts/upload-image] missing public URL for path:", filePath);
      return NextResponse.json(
        { message: "Failed to retrieve image URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ image_url: publicUrl }, { status: 200 });
  } catch (err) {
    console.error("[drafts/upload-image] unhandled error:", err);
    return NextResponse.json(
      {
        message: "Server error while uploading image",
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}

