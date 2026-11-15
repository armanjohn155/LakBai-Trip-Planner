<?php

namespace App\Services;

use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Re-encodes uploaded travel photos with GD.
 *
 * Re-encoding is intentional: it drops EXIF (including GPS), fixes the
 * orientation flag, normalises the format and produces a thumbnail. The only
 * thing copied from the EXIF block is the orientation value, read before the
 * original image is discarded.
 */
class PhotoProcessor
{
    /**
     * @return array{path: string, thumbnail_path: string, width: int, height: int}
     */
    public function process(UploadedFile $file, int $itineraryId): array
    {
        if (! function_exists('imagecreatefromstring')) {
            throw ValidationException::withMessages([
                'photo' => 'Photo processing is unavailable on this server.',
            ]);
        }

        $contents = file_get_contents($file->getRealPath());

        if ($contents === false) {
            throw ValidationException::withMessages([
                'photo' => 'The photo could not be read.',
            ]);
        }

        $image = @imagecreatefromstring($contents);

        if (! $image instanceof GdImage) {
            throw ValidationException::withMessages([
                'photo' => 'The photo is not a valid image.',
            ]);
        }

        $image = $this->applyOrientation($image, $this->orientation($file));
        $image = $this->fit($image, (int) config('lakbai.recap.max_image_px', 2400));

        $name = Str::uuid()->toString().'.jpg';
        $directory = 'recap-photos/'.$itineraryId;

        $path = $directory.'/'.$name;
        $thumbnailPath = $directory.'/thumbs/'.$name;

        $width = imagesx($image);
        $height = imagesy($image);

        Storage::disk('public')->put($path, $this->encode($image, 86));

        $thumbnail = $this->fit($image, (int) config('lakbai.recap.thumbnail_max_px', 480));
        Storage::disk('public')->put($thumbnailPath, $this->encode($thumbnail, 80));

        if ($thumbnail !== $image) {
            imagedestroy($thumbnail);
        }

        imagedestroy($image);

        return [
            'path' => $path,
            'thumbnail_path' => $thumbnailPath,
            'width' => $width,
            'height' => $height,
        ];
    }

    private function orientation(UploadedFile $file): int
    {
        if (! function_exists('exif_read_data')) {
            return 1;
        }

        $exif = @exif_read_data($file->getRealPath());

        return is_array($exif) && isset($exif['Orientation'])
            ? (int) $exif['Orientation']
            : 1;
    }

    private function applyOrientation(GdImage $image, int $orientation): GdImage
    {
        return match ($orientation) {
            2 => $this->flip($image, IMG_FLIP_HORIZONTAL),
            3 => $this->rotate($image, 180),
            4 => $this->flip($image, IMG_FLIP_VERTICAL),
            5 => $this->flip($this->rotate($image, -90), IMG_FLIP_HORIZONTAL),
            6 => $this->rotate($image, -90),
            7 => $this->flip($this->rotate($image, 90), IMG_FLIP_HORIZONTAL),
            8 => $this->rotate($image, 90),
            default => $image,
        };
    }

    private function rotate(GdImage $image, int $degrees): GdImage
    {
        $rotated = imagerotate($image, $degrees, 0);

        if (! $rotated instanceof GdImage) {
            return $image;
        }

        imagedestroy($image);

        return $rotated;
    }

    private function flip(GdImage $image, int $mode): GdImage
    {
        imageflip($image, $mode);

        return $image;
    }

    private function fit(GdImage $image, int $maxPixels): GdImage
    {
        $maxPixels = max(40, $maxPixels);
        $width = imagesx($image);
        $height = imagesy($image);
        $longest = max($width, $height);

        if ($longest <= $maxPixels) {
            return $image;
        }

        $scale = $maxPixels / $longest;
        $newWidth = max(1, (int) round($width * $scale));
        $newHeight = max(1, (int) round($height * $scale));

        $canvas = imagecreatetruecolor($newWidth, $newHeight);

        // Flatten transparency onto white so PNG/WebP uploads become a sane JPEG.
        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $white);
        imagecopyresampled($canvas, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        imagedestroy($image);

        return $canvas;
    }

    private function encode(GdImage $image, int $quality): string
    {
        ob_start();
        imagejpeg($image, null, $quality);
        $contents = ob_get_clean();

        if ($contents === false || $contents === '') {
            throw ValidationException::withMessages([
                'photo' => 'The photo could not be processed.',
            ]);
        }

        return $contents;
    }
}
