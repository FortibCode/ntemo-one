<?php

namespace App\Services\Documents;

use Dompdf\Dompdf;
use Dompdf\Options;
use InvalidArgumentException;
use PhpOffice\PhpWord\IOFactory as WordIOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Shared\Html as WordHtml;

/**
 * Rendu des modèles documentaires (HTML balisé {{variable}}) en fichiers réels :
 * PDF (Dompdf) et Word .docx (PhpWord), avec en-tête et pied de page NTEMO.
 */
class DocumentRenderer
{
    public const SUPPORTED_FORMATS = ['PDF', 'DOCX'];

    /** Balise de variable : {{ employee.full_name }} (espaces tolérés). */
    private const PLACEHOLDER = '/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/';

    /**
     * Liste des variables utilisées par un modèle.
     *
     * @return string[]
     */
    public function placeholders(string $template): array
    {
        preg_match_all(self::PLACEHOLDER, $template, $m);

        return array_values(array_unique($m[1]));
    }

    /**
     * Fusionne les variables dans le modèle. Les valeurs sont échappées (pas d'injection HTML).
     *
     * @throws InvalidArgumentException si des variables requises sont absentes
     */
    public function merge(string $template, array $variables): string
    {
        $missing = array_values(array_filter(
            $this->placeholders($template),
            fn (string $key) => !array_key_exists($key, $variables) || $variables[$key] === null || $variables[$key] === ''
        ));

        if ($missing) {
            throw new MissingVariablesException($missing);
        }

        return preg_replace_callback(self::PLACEHOLDER, function (array $m) use ($variables) {
            $value = $variables[$m[1]];
            $string = is_scalar($value) ? (string) $value : json_encode($value, JSON_UNESCAPED_UNICODE);

            return nl2br(htmlspecialchars($string, ENT_QUOTES | ENT_HTML5, 'UTF-8'), false);
        }, $template);
    }

    /**
     * @param array{title: string, reference: string, organization: string, footer?: string} $meta
     */
    public function render(string $format, string $bodyHtml, array $meta): string
    {
        return match (strtoupper($format)) {
            'PDF' => $this->toPdf($bodyHtml, $meta),
            'DOCX' => $this->toDocx($bodyHtml, $meta),
            default => throw new InvalidArgumentException("Format de sortie « {$format} » non pris en charge par les modèles (PDF ou DOCX)."),
        };
    }

    public function toPdf(string $bodyHtml, array $meta): string
    {
        $options = new Options();
        // Sécurité : aucune ressource distante, accès disque limité aux ressources de l'application
        $options->setIsRemoteEnabled(false);
        $options->setChroot([resource_path()]);
        $options->setDefaultFont('DejaVu Sans');
        $options->setIsPhpEnabled(false);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($this->pdfLayout($bodyHtml, $meta), 'UTF-8');
        $dompdf->setPaper('A4');
        $dompdf->addInfo('Title', $meta['title']);
        $dompdf->addInfo('Author', $meta['organization']);
        $dompdf->addInfo('Creator', 'NTEMO ONE');
        $dompdf->addInfo('Subject', 'Réf. ' . $meta['reference']);
        $dompdf->render();

        return $dompdf->output();
    }

    public function toDocx(string $bodyHtml, array $meta): string
    {
        $word = new PhpWord();
        $word->setDefaultFontName('Calibri');
        $word->setDefaultFontSize(11);
        $word->getDocInfo()
            ->setTitle($meta['title'])
            ->setCreator('NTEMO ONE')
            ->setCompany($meta['organization'])
            ->setSubject('Réf. ' . $meta['reference']);

        $section = $word->addSection([
            'marginTop' => 1200, 'marginBottom' => 1200, 'marginLeft' => 1300, 'marginRight' => 1300,
        ]);

        $header = $section->addHeader();
        $table = $header->addTable();
        $row = $table->addRow();
        if (is_file($this->logoPath())) {
            $row->addCell(1800)->addImage($this->logoPath(), ['height' => 40]);
        }
        $row->addCell(7000)->addText($meta['organization'], ['bold' => true, 'size' => 13, 'color' => '0B2563']);

        WordHtml::addHtml($section, $this->wordCompatible($bodyHtml), false, false);

        $footer = $section->addFooter();
        $footer->addText(
            $this->footerText($meta),
            ['size' => 8, 'color' => '6B7280'],
            ['alignment' => 'center']
        );

        $tmp = tempnam(sys_get_temp_dir(), 'ntemo_docx_');
        try {
            WordIOFactory::createWriter($word, 'Word2007')->save($tmp);

            return file_get_contents($tmp);
        } finally {
            @unlink($tmp);
        }
    }

    public function logoPath(): string
    {
        return resource_path('images/logo.png');
    }

    public function logoDataUri(): ?string
    {
        $path = $this->logoPath();

        return is_file($path) ? 'data:image/png;base64,' . base64_encode(file_get_contents($path)) : null;
    }

    private function footerText(array $meta): string
    {
        return $meta['footer']
            ?? "{$meta['organization']} — Document généré par NTEMO ONE — Réf. {$meta['reference']}";
    }

    /**
     * PhpWord n'accepte que du XHTML bien formé : on normalise les balises orphelines.
     */
    private function wordCompatible(string $html): string
    {
        $html = preg_replace('/<br\s*>/i', '<br/>', $html);
        $html = preg_replace('/<hr\s*>/i', '<hr/>', $html);

        return $html;
    }

    private function pdfLayout(string $bodyHtml, array $meta): string
    {
        $logo = $this->logoDataUri();
        $org = htmlspecialchars($meta['organization'], ENT_QUOTES, 'UTF-8');
        $title = htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8');
        $footer = htmlspecialchars($this->footerText($meta), ENT_QUOTES, 'UTF-8');
        $logoTag = $logo ? "<img src=\"{$logo}\" class=\"logo\" alt=\"\">" : '';

        return <<<HTML
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>{$title}</title>
<style>
  @page { margin: 32mm 20mm 22mm 20mm; }
  body { font-family: "DejaVu Sans", sans-serif; font-size: 10.5pt; color: #1f2937; line-height: 1.55; }
  header { position: fixed; top: -24mm; left: 0; right: 0; height: 18mm; border-bottom: 2px solid #1C9BD6; }
  header .logo { height: 14mm; float: left; }
  header .org { float: right; text-align: right; font-weight: bold; color: #0B2563; font-size: 12pt; padding-top: 4mm; }
  footer { position: fixed; bottom: -14mm; left: 0; right: 0; height: 8mm; border-top: 1px solid #d1d5db;
           font-size: 7.5pt; color: #6b7280; text-align: center; padding-top: 2mm; }
  h1 { font-size: 16pt; color: #0B2563; text-align: center; margin: 4mm 0 8mm; letter-spacing: 0.5pt; }
  h2 { font-size: 12pt; color: #0D5C9E; margin: 6mm 0 2mm; }
  p { margin: 0 0 3mm; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 3mm 0; }
  td, th { border: 1px solid #d1d5db; padding: 2mm 3mm; font-size: 9.5pt; }
  th { background: #eef6fb; color: #0B2563; text-align: left; }
  .signature { margin-top: 14mm; text-align: right; }
</style></head>
<body>
<header>{$logoTag}<div class="org">{$org}</div></header>
<footer>{$footer}</footer>
<main>{$bodyHtml}</main>
</body></html>
HTML;
    }
}
