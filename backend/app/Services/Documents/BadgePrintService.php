<?php

namespace App\Services\Documents;

use App\Models\Badge;
use chillerlan\QRCode\Common\EccLevel;
use chillerlan\QRCode\Output\QRGdImagePNG;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use Dompdf\Dompdf;
use Dompdf\Options;

/**
 * Badge imprimable recto/verso au format carte CR80 (85,6 × 54 mm), en PDF
 * (cahier des charges §3.2 « Génération de badge impression »).
 *
 * Le QR code du verso encode le jeton de sécurité du badge, vérifiable via
 * POST /badges/verify ; un badge révoqué est donc refusé même s'il est imprimé.
 */
class BadgePrintService
{
    /** CR80 en points PDF (1 mm = 2,83465 pt). */
    private const CARD_WIDTH_PT = 242.65;
    private const CARD_HEIGHT_PT = 153.07;

    public function __construct(
        protected DocumentRenderer $renderer
    ) {}

    public function pdf(Badge $badge): string
    {
        $badge->loadMissing(['employee.department', 'employee.position', 'organization']);

        $options = new Options();
        $options->setIsRemoteEnabled(false);
        $options->setChroot([resource_path()]);
        $options->setDefaultFont('DejaVu Sans');
        $options->setIsPhpEnabled(false);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($this->html($badge), 'UTF-8');
        $dompdf->setPaper([0, 0, self::CARD_WIDTH_PT, self::CARD_HEIGHT_PT]);
        $dompdf->addInfo('Title', "Badge {$badge->badge_number}");
        $dompdf->addInfo('Creator', 'NTEMO ONE');
        $dompdf->render();

        return $dompdf->output();
    }

    public function qrDataUri(string $data): string
    {
        $options = new QROptions([
            'outputInterface' => QRGdImagePNG::class,
            'eccLevel' => EccLevel::M,
            'scale' => 8,
            'outputBase64' => true,
            'addQuietzone' => true,
            'quietzoneSize' => 2,
        ]);

        return (new QRCode($options))->render($data);
    }

    private function html(Badge $badge): string
    {
        $e = $badge->employee;
        $esc = fn (?string $v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');

        $logo = $this->renderer->logoDataUri();
        $logoTag = $logo ? "<img class=\"logo\" src=\"{$logo}\" alt=\"\">" : '';
        $org = $esc($badge->organization?->name ?? 'NTEMO');
        $name = $esc($e?->full_name);
        $position = $esc($e?->position?->title ?? 'Collaborateur');
        $department = $esc($e?->department?->name ?? '');
        $matricule = $esc($e?->matricule);
        $number = $esc($badge->badge_number);
        $initials = $esc(mb_strtoupper(mb_substr($e?->first_name ?? '', 0, 1) . mb_substr($e?->last_name ?? '', 0, 1)));
        $issued = $badge->issued_at?->format('d/m/Y') ?? '—';
        $expires = $badge->expires_at?->format('d/m/Y') ?? 'Sans limite';
        $qr = $this->qrDataUri($badge->security_token);

        // Photo du collaborateur si disponible dans le stockage privé, sinon initiales
        $photo = "<table class=\"avatar\"><tr><td>{$initials}</td></tr></table>";
        if ($e?->photo_path && is_file($path = storage_path('app/private/' . ltrim($e->photo_path, '/')))) {
            $mime = mime_content_type($path) ?: 'image/jpeg';
            if (str_starts_with($mime, 'image/')) {
                $photo = '<img class="photo" src="data:' . $mime . ';base64,' . base64_encode(file_get_contents($path)) . '" alt="">';
            }
        }

        return <<<HTML
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "DejaVu Sans", sans-serif; color: #0B2563; }
  .card { width: 85.6mm; height: 53.6mm; position: relative; overflow: hidden; }
  .recto { background: #ffffff; }
  .band { position: absolute; left: 0; top: 0; width: 85.6mm; height: 13mm; background: #0B2563; }
  .band-accent { position: absolute; left: 0; top: 13mm; width: 85.6mm; height: 1.2mm; background: #1C9BD6; }
  .logo { position: absolute; left: 3mm; top: 2mm; height: 9mm; background: #fff; border-radius: 1.5mm; padding: 0.6mm; }
  .org { position: absolute; right: 3.5mm; top: 3.6mm; color: #fff; font-size: 7.5pt; font-weight: bold; text-align: right; }
  .org small { display: block; color: #9fd8f2; font-size: 5.5pt; font-weight: normal; }
  .photo { position: absolute; left: 4mm; top: 18mm; width: 20mm; height: 24mm; border-radius: 2mm; border: 0.5mm solid #1C9BD6; }
  .avatar { position: absolute; left: 4mm; top: 18mm; width: 20mm; height: 24mm; border-collapse: collapse; }
  .avatar td { background: #EAF6FC; border: 0.5mm solid #1C9BD6; border-radius: 2mm; text-align: center; vertical-align: middle;
               font-size: 20pt; font-weight: bold; color: #0D5C9E; padding: 0; width: 19mm; height: 23mm; }
  .info { position: absolute; left: 27mm; top: 18.5mm; right: 3mm; }
  .name { font-size: 10pt; font-weight: bold; line-height: 1.15; }
  .position { font-size: 7pt; color: #0D5C9E; margin-top: 1mm; }
  .department { font-size: 6pt; color: #6b7280; margin-top: 0.5mm; }
  .label { font-size: 4.8pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3pt; margin-top: 2.2mm; }
  .value { font-size: 7.5pt; font-weight: bold; font-family: "DejaVu Sans Mono", monospace; }
  .foot { position: absolute; left: 0; top: 49.4mm; width: 85.6mm; height: 4mm; background: #EAF6FC; font-size: 5pt; color: #0D5C9E; text-align: center; line-height: 4mm; }
  .verso { background: #0B2563; color: #fff; page-break-before: always; }
  .qr { position: absolute; left: 4mm; top: 6mm; width: 32mm; height: 32mm; background: #fff; border-radius: 2mm; padding: 1mm; }
  .qr img { width: 30mm; height: 30mm; }
  .verso .text { position: absolute; left: 40mm; top: 6mm; right: 4mm; font-size: 6pt; line-height: 1.45; color: #dbeafe; }
  .verso .title { font-size: 8pt; font-weight: bold; color: #fff; margin-bottom: 1.5mm; }
  .verso .meta { position: absolute; left: 4mm; top: 45mm; right: 4mm; font-size: 5.5pt; color: #9fd8f2; }
</style></head>
<body>
  <div class="card recto">
    <div class="band"></div><div class="band-accent"></div>
    {$logoTag}
    <div class="org">{$org}<small>Badge collaborateur</small></div>
    {$photo}
    <div class="info">
      <div class="name">{$name}</div>
      <div class="position">{$position}</div>
      <div class="department">{$department}</div>
      <div class="label">Matricule</div>
      <div class="value">{$matricule}</div>
    </div>
    <div class="foot">N° {$number}</div>
  </div>
  <div class="card verso">
    <div class="qr"><img src="{$qr}" alt=""></div>
    <div class="text">
      <div class="title">Badge d'identification</div>
      Ce badge est personnel et incessible. Il doit être porté de façon visible dans les locaux.<br><br>
      En cas de perte ou de vol, prévenez immédiatement le service RH : le badge sera révoqué.
    </div>
    <div class="meta">Émis le {$issued} &nbsp;•&nbsp; Expire : {$expires} &nbsp;•&nbsp; {$number}</div>
  </div>
</body></html>
HTML;
    }
}
