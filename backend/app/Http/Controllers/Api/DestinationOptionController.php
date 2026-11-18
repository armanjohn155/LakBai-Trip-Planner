<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DestinationOptionService;
use Illuminate\Http\JsonResponse;

class DestinationOptionController extends Controller
{
    public function __construct(private readonly DestinationOptionService $options) {}

    /**
     * Public, active-only option lists used by filters and chips.
     */
    public function index(): JsonResponse
    {
        return response()->json($this->options->options());
    }
}
