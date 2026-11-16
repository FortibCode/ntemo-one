<?php

namespace App\Services\Documents;

use RuntimeException;
use ZipArchive;

/**
 * Générateur PowerPoint (.pptx, Office Open XML) minimal et sans dépendance.
 *
 * PhpPresentation n'est pas utilisable : elle impose une version de PhpSpreadsheet
 * affectée par des failles de sécurité. Ce générateur couvre les besoins NTEMO :
 * diapositive de titre, puces, tableau et indicateurs, à la charte NTEMO (16:9).
 */
class PptxBuilder
{
    // Diapositive 16:9 en EMU (1 cm = 360 000 EMU)
    private const W = 12192000;
    private const H = 6858000;

    private const NAVY = '0B2563';
    private const BLUE = '0D5C9E';
    private const CYAN = '1C9BD6';
    private const MIST = 'EAF6FC';
    private const INK = '1F2937';
    private const MUTED = '6B7280';

    /** @var array<int, array{xml: string, logo: bool}> */
    private array $slides = [];
    private int $shapeId = 2;

    public function __construct(
        private string $title,
        private string $organization,
        private ?string $logoPath = null,
        private string $footer = ''
    ) {}

    public function titleSlide(string $title, ?string $subtitle = null, ?string $caption = null): self
    {
        $shapes = $this->rect(0, 0, self::W, self::H, self::NAVY)
            . $this->rect(0, 5_900_000, self::W, 80_000, self::CYAN);
        if ($this->hasLogo()) {
            // Logo dans un cartouche blanc, proportions d'origine conservées
            [$iw, $ih] = getimagesize($this->logoPath) ?: [1, 1];
            $logoW = 1_340_000;
            $logoH = (int) round($logoW * $ih / max(1, $iw));
            $shapes .= $this->rect(720_000, 720_000, $logoW + 160_000, $logoH + 160_000, 'FFFFFF')
                . $this->picture(800_000, 800_000, $logoW, $logoH);
        }
        $shapes .= $this->text(720_000, 2_400_000, 10_700_000, 1_500_000, [[$title, 4000, true, 'FFFFFF']], 'b');
        if ($subtitle) {
            $shapes .= $this->text(720_000, 3_950_000, 10_700_000, 900_000, [[$subtitle, 2200, false, '9FD8F2']]);
        }
        $shapes .= $this->text(720_000, 6_050_000, 10_700_000, 500_000, [[$caption ?? $this->organization, 1200, false, 'C7D2FE']]);

        return $this->addSlide($shapes, $this->hasLogo());
    }

    /** @param string[] $bullets */
    public function bulletSlide(string $title, array $bullets): self
    {
        $paragraphs = array_map(fn ($b) => [$b, 2000, false, self::INK, true], $bullets ?: ['—']);

        return $this->addSlide($this->header($title) . $this->text(720_000, 1_500_000, 10_750_000, 4_700_000, $paragraphs) . $this->footerShapes());
    }

    /**
     * @param string[] $headers
     * @param array<int, array<int, string>> $rows
     */
    public function tableSlide(string $title, array $headers, array $rows, ?string $note = null): self
    {
        $shapes = $this->header($title) . $this->table(720_000, 1_450_000, 10_750_000, $headers, $rows ?: [array_fill(0, count($headers), '—')]);
        if ($note) {
            $shapes .= $this->text(720_000, 5_850_000, 10_750_000, 400_000, [[$note, 1100, false, self::MUTED]]);
        }

        return $this->addSlide($shapes . $this->footerShapes());
    }

    /** @param array<int, array{0: string, 1: string}> $kpis libellé, valeur (4 au maximum par diapositive) */
    public function kpiSlide(string $title, array $kpis, ?string $note = null): self
    {
        $shapes = $this->header($title);
        $count = max(1, min(4, count($kpis)));
        $gap = 300_000;
        $width = intdiv(10_750_000 - ($count - 1) * $gap, $count);
        foreach (array_slice($kpis, 0, 4) as $i => [$label, $value]) {
            $x = 720_000 + $i * ($width + $gap);
            $shapes .= $this->rect($x, 1_900_000, $width, 2_200_000, self::MIST, self::CYAN)
                . $this->text($x, 2_150_000, $width, 1_000_000, [[$value, 3600, true, self::NAVY]], 't', 'ctr')
                . $this->text($x, 3_200_000, $width, 700_000, [[$label, 1400, false, self::BLUE]], 't', 'ctr');
        }
        if ($note) {
            $shapes .= $this->text(720_000, 4_600_000, 10_750_000, 1_000_000, [[$note, 1400, false, self::INK]]);
        }

        return $this->addSlide($shapes . $this->footerShapes());
    }

    /** Ajoute à la suite les diapositives d'une autre présentation. */
    public function append(PptxBuilder $other): self
    {
        foreach ($other->slides as $slide) {
            $this->slides[] = $slide;
        }

        return $this;
    }

    public function count(): int
    {
        return count($this->slides);
    }

    /** @return string Contenu binaire du fichier .pptx */
    public function build(): string
    {
        if (!$this->slides) {
            throw new RuntimeException('La présentation ne contient aucune diapositive.');
        }

        $tmp = tempnam(sys_get_temp_dir(), 'ntemo_pptx_');
        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Impossible de créer l\'archive PowerPoint.');
        }

        $n = count($this->slides);
        $zip->addFromString('[Content_Types].xml', $this->contentTypes($n));
        $zip->addFromString('_rels/.rels', $this->rels([
            ['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', 'ppt/presentation.xml'],
            ['rId2', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'],
            ['rId3', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties', 'docProps/app.xml'],
        ]));
        $zip->addFromString('docProps/core.xml', $this->coreProps());
        $zip->addFromString('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
            . '<Application>NTEMO ONE</Application><Slides>' . $n . '</Slides></Properties>');

        $presRels = [
            ['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster', 'slideMasters/slideMaster1.xml'],
            ['rId2', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', 'theme/theme1.xml'],
        ];
        $sldIds = '';
        foreach ($this->slides as $i => $slide) {
            $num = $i + 1;
            $presRels[] = ['rId' . ($num + 2), 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', "slides/slide{$num}.xml"];
            $sldIds .= '<p:sldId id="' . (255 + $num) . '" r:id="rId' . ($num + 2) . '"/>';

            $slideRels = [['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout', '../slideLayouts/slideLayout1.xml']];
            if ($slide['logo']) {
                $slideRels[] = ['rId2', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', '../media/logo.png'];
            }
            $zip->addFromString("ppt/slides/slide{$num}.xml", $slide['xml']);
            $zip->addFromString("ppt/slides/_rels/slide{$num}.xml.rels", $this->rels($slideRels));
        }

        $zip->addFromString('ppt/presentation.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<p:presentation ' . $this->ns() . ' saveSubsetFonts="1">'
            . '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
            . '<p:sldIdLst>' . $sldIds . '</p:sldIdLst>'
            . '<p:sldSz cx="' . self::W . '" cy="' . self::H . '"/><p:notesSz cx="6858000" cy="9144000"/>'
            . '</p:presentation>');
        $zip->addFromString('ppt/_rels/presentation.xml.rels', $this->rels($presRels));

        $zip->addFromString('ppt/slideMasters/slideMaster1.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<p:sldMaster ' . $this->ns() . '><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'
            . '<p:spTree>' . $this->groupProps() . '</p:spTree></p:cSld>'
            . '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
            . '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
            . '<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>');
        $zip->addFromString('ppt/slideMasters/_rels/slideMaster1.xml.rels', $this->rels([
            ['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout', '../slideLayouts/slideLayout1.xml'],
            ['rId2', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', '../theme/theme1.xml'],
        ]));
        $zip->addFromString('ppt/slideLayouts/slideLayout1.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<p:sldLayout ' . $this->ns() . ' type="blank" preserve="1"><p:cSld name="Vierge"><p:spTree>' . $this->groupProps() . '</p:spTree></p:cSld>'
            . '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');
        $zip->addFromString('ppt/slideLayouts/_rels/slideLayout1.xml.rels', $this->rels([
            ['rId1', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster', '../slideMasters/slideMaster1.xml'],
        ]));
        $zip->addFromString('ppt/theme/theme1.xml', $this->theme());
        if ($this->hasLogo()) {
            $zip->addFile($this->logoPath, 'ppt/media/logo.png');
        }

        $zip->close();
        try {
            return file_get_contents($tmp);
        } finally {
            @unlink($tmp);
        }
    }

    // ── Formes ───────────────────────────────────────────────────────────

    private function addSlide(string $shapes, bool $logo = false): self
    {
        $this->slides[] = [
            'xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<p:sld ' . $this->ns() . '><p:cSld><p:spTree>' . $this->groupProps() . $shapes . '</p:spTree></p:cSld>'
                . '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
            'logo' => $logo,
        ];
        $this->shapeId = 2;

        return $this;
    }

    private function header(string $title): string
    {
        return $this->rect(0, 0, self::W, 1_050_000, self::NAVY)
            . $this->rect(0, 1_050_000, self::W, 60_000, self::CYAN)
            . $this->text(720_000, 180_000, 10_750_000, 750_000, [[$title, 2800, true, 'FFFFFF']], 'ctr');
    }

    private function footerShapes(): string
    {
        $label = $this->footer ?: "{$this->organization} — {$this->title}";

        return $this->text(720_000, 6_350_000, 10_750_000, 350_000, [[$label, 1000, false, self::MUTED]]);
    }

    private function rect(int $x, int $y, int $w, int $h, string $fill, ?string $line = null): string
    {
        $id = $this->shapeId++;
        $ln = $line ? '<a:ln w="19050"><a:solidFill><a:srgbClr val="' . $line . '"/></a:solidFill></a:ln>' : '<a:ln><a:noFill/></a:ln>';

        return '<p:sp><p:nvSpPr><p:cNvPr id="' . $id . '" name="Forme ' . $id . '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            . '<p:spPr>' . $this->xfrm($x, $y, $w, $h) . '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
            . '<a:solidFill><a:srgbClr val="' . $fill . '"/></a:solidFill>' . $ln . '</p:spPr></p:sp>';
    }

    /**
     * @param array<int, array{0: string, 1: int, 2: bool, 3: string, 4?: bool}> $paragraphs texte, taille (centièmes de pt), gras, couleur, puce
     */
    private function text(int $x, int $y, int $w, int $h, array $paragraphs, string $anchor = 't', string $align = 'l'): string
    {
        $id = $this->shapeId++;
        $body = '';
        foreach ($paragraphs as $p) {
            [$content, $size, $bold, $color] = $p;
            $bullet = $p[4] ?? false;
            $pPr = $bullet
                ? '<a:pPr marL="342900" indent="-342900" algn="' . $align . '"><a:spcBef><a:spcPts val="900"/></a:spcBef><a:buClr><a:srgbClr val="' . self::CYAN . '"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>'
                : '<a:pPr algn="' . $align . '"><a:buNone/></a:pPr>';
            $body .= '<a:p>' . $pPr . '<a:r><a:rPr lang="fr-FR" sz="' . $size . '" b="' . ($bold ? 1 : 0) . '" dirty="0">'
                . '<a:solidFill><a:srgbClr val="' . $color . '"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr>'
                . '<a:t>' . $this->esc($content) . '</a:t></a:r></a:p>';
        }

        return '<p:sp><p:nvSpPr><p:cNvPr id="' . $id . '" name="Texte ' . $id . '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
            . '<p:spPr>' . $this->xfrm($x, $y, $w, $h) . '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
            . '<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="' . $anchor . '"><a:normAutofit/></a:bodyPr>'
            . '<a:lstStyle/>' . $body . '</p:txBody></p:sp>';
    }

    private function picture(int $x, int $y, int $w, int $h): string
    {
        $id = $this->shapeId++;

        return '<p:pic><p:nvPicPr><p:cNvPr id="' . $id . '" name="Logo"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>'
            . '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
            . '<p:spPr>' . $this->xfrm($x, $y, $w, $h) . '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
    }

    private function table(int $x, int $y, int $w, array $headers, array $rows): string
    {
        $id = $this->shapeId++;
        $cols = max(1, count($headers));
        $colW = intdiv($w, $cols);
        $rowH = 370_840;
        $grid = str_repeat('<a:gridCol w="' . $colW . '"/>', $cols);

        $cell = function (string $text, bool $head, bool $zebra): string {
            $fill = $head ? self::NAVY : ($zebra ? self::MIST : 'FFFFFF');
            $color = $head ? 'FFFFFF' : self::INK;

            return '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1200" b="' . ($head ? 1 : 0) . '" dirty="0">'
                . '<a:solidFill><a:srgbClr val="' . $color . '"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr>'
                . '<a:t>' . $this->esc($text) . '</a:t></a:r></a:p></a:txBody>'
                . '<a:tcPr marL="91440" marR="91440" marT="45720" marB="45720" anchor="ctr"><a:solidFill><a:srgbClr val="' . $fill . '"/></a:solidFill></a:tcPr></a:tc>';
        };

        $xml = '<a:tr h="' . $rowH . '">' . implode('', array_map(fn ($h) => $cell((string) $h, true, false), $headers)) . '</a:tr>';
        foreach (array_slice($rows, 0, 12) as $i => $row) {
            $row = array_pad(array_slice(array_values($row), 0, $cols), $cols, '');
            $xml .= '<a:tr h="' . $rowH . '">' . implode('', array_map(fn ($v) => $cell((string) $v, false, $i % 2 === 1), $row)) . '</a:tr>';
        }

        $height = $rowH * (min(count($rows), 12) + 1);

        return '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="' . $id . '" name="Tableau ' . $id . '"/>'
            . '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>'
            . '<p:xfrm><a:off x="' . $x . '" y="' . $y . '"/><a:ext cx="' . $w . '" cy="' . $height . '"/></p:xfrm>'
            . '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">'
            . '<a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>' . $grid . '</a:tblGrid>' . $xml . '</a:tbl>'
            . '</a:graphicData></a:graphic></p:graphicFrame>';
    }

    // ── Parties du paquet ────────────────────────────────────────────────

    private function hasLogo(): bool
    {
        return $this->logoPath !== null && is_file($this->logoPath);
    }

    private function xfrm(int $x, int $y, int $w, int $h): string
    {
        return '<a:xfrm><a:off x="' . $x . '" y="' . $y . '"/><a:ext cx="' . $w . '" cy="' . $h . '"/></a:xfrm>';
    }

    private function groupProps(): string
    {
        return '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
            . '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
    }

    private function ns(): string
    {
        return 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            . 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
    }

    /** @param array<int, array{0: string, 1: string, 2: string}> $rels */
    private function rels(array $rels): string
    {
        $xml = '';
        foreach ($rels as [$id, $type, $target]) {
            $xml .= '<Relationship Id="' . $id . '" Type="' . $type . '" Target="' . $target . '"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . $xml . '</Relationships>';
    }

    private function contentTypes(int $slides): string
    {
        $pml = 'application/vnd.openxmlformats-officedocument.presentationml.';
        $overrides = '<Override PartName="/ppt/presentation.xml" ContentType="' . $pml . 'presentation.main+xml"/>'
            . '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="' . $pml . 'slideMaster+xml"/>'
            . '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="' . $pml . 'slideLayout+xml"/>'
            . '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
            . '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            . '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>';
        for ($i = 1; $i <= $slides; $i++) {
            $overrides .= '<Override PartName="/ppt/slides/slide' . $i . '.xml" ContentType="' . $pml . 'slide+xml"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Default Extension="png" ContentType="image/png"/>'
            . $overrides . '</Types>';
    }

    private function coreProps(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            . 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
            . 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            . '<dc:title>' . $this->esc($this->title) . '</dc:title><dc:creator>NTEMO ONE</dc:creator>'
            . '<dcterms:created xsi:type="dcterms:W3CDTF">' . gmdate('Y-m-d\TH:i:s\Z') . '</dcterms:created>'
            . '</cp:coreProperties>';
    }

    private function theme(): string
    {
        $colors = ['dk1' => '000000', 'lt1' => 'FFFFFF', 'dk2' => self::NAVY, 'lt2' => self::MIST,
            'accent1' => self::CYAN, 'accent2' => self::BLUE, 'accent3' => self::NAVY, 'accent4' => '38BDF8',
            'accent5' => '64748B', 'accent6' => '0EA5E9', 'hlink' => self::BLUE, 'folHlink' => '6B21A8'];
        $clr = '';
        foreach ($colors as $name => $hex) {
            $clr .= in_array($name, ['dk1', 'lt1'], true)
                ? "<a:{$name}><a:sysClr val=\"" . ($name === 'dk1' ? 'windowText' : 'window') . "\" lastClr=\"{$hex}\"/></a:{$name}>"
                : "<a:{$name}><a:srgbClr val=\"{$hex}\"/></a:{$name}>";
        }
        $fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
        $line = '<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
        $effect = '<a:effectStyle><a:effectLst/></a:effectStyle>';

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="NTEMO">'
            . '<a:themeElements><a:clrScheme name="NTEMO">' . $clr . '</a:clrScheme>'
            . '<a:fontScheme name="NTEMO"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'
            . '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>'
            . '<a:fmtScheme name="NTEMO"><a:fillStyleLst>' . str_repeat($fill, 3) . '</a:fillStyleLst>'
            . '<a:lnStyleLst>' . str_repeat($line, 3) . '</a:lnStyleLst>'
            . '<a:effectStyleLst>' . str_repeat($effect, 3) . '</a:effectStyleLst>'
            . '<a:bgFillStyleLst>' . str_repeat($fill, 3) . '</a:bgFillStyleLst></a:fmtScheme>'
            . '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';
    }

    private function esc(string $text): string
    {
        // Retire les caractères de contrôle interdits en XML 1.0
        $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $text) ?? '';

        return htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
