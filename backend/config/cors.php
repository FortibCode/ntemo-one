<?php

/*
| CORS : origines autorisées à appeler l'API depuis un navigateur.
| En production, limiter à l'adresse du portail, par exemple
| CORS_ALLOWED_ORIGINS=https://app.ntemo-one.com (plusieurs valeurs séparées par des virgules).
| L'application mobile n'est pas concernée (pas de contrôle CORS hors navigateur).
*/

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', '*'))))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['Content-Disposition'],
    'max_age' => 0,
    'supports_credentials' => false,
];
