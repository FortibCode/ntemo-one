<?php

namespace App\Services\Documents;

use InvalidArgumentException;

/**
 * Variables de modèle non fournies : la génération est refusée plutôt que de
 * produire un document officiel incomplet.
 */
class MissingVariablesException extends InvalidArgumentException
{
    /** @param string[] $variables */
    public function __construct(public readonly array $variables)
    {
        parent::__construct('Variables manquantes pour ce modèle : ' . implode(', ', $variables) . '.');
    }
}
