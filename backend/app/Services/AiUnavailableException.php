<?php

namespace App\Services;

use RuntimeException;

/**
 * Indisponibilité de l'assistant IA, avec un message destiné à l'utilisateur
 * (le code porte le statut HTTP à renvoyer).
 */
class AiUnavailableException extends RuntimeException
{
}
