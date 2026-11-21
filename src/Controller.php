<?php

namespace ElChoco\Editorial;

use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class Controller implements RequestHandlerInterface
{
    public function __construct(private readonly DraftService $drafts) {}

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();
        $actor->assertCan('el-choco-editorial.use');
        $params = $request->getQueryParams();
        $id = $params['id'] ?? null;
        try {
            if ($id !== null && (!is_scalar($id) || !ctype_digit((string) $id) || (int) $id < 1)) {
                throw new EditorialException('not_found', 404);
            }
            if ($request->getMethod() === 'POST') {
                $input = $request->getParsedBody();
                if (!is_array($input) || strlen(json_encode($input, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)) > 300000) {
                    throw new EditorialException('invalid');
                }
                $data = $id ? $this->drafts->mutate($actor, (int) $id, $input, $request) : $this->drafts->create($actor, $input);
            } elseif ($id && isset($params['revision'])) {
                $revision = $params['revision'];
                if (!is_scalar($revision) || !ctype_digit((string) $revision)) {
                    throw new EditorialException('not_found', 404);
                }
                $data = $this->drafts->revision($actor, (int) $id, (int) $revision);
            } elseif ($id) {
                $data = $this->drafts->detail($actor, (int) $id);
            } else {
                $page = filter_var($params['page'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
                if (!$page) {
                    throw new EditorialException('invalid');
                }
                foreach (['status', 'sort'] as $key) {
                    if (isset($params[$key]) && !is_string($params[$key])) {
                        throw new EditorialException('invalid');
                    }
                }
                $data = $this->drafts->listing($actor, $page, $params['status'] ?? null, $params['sort'] ?? null);
            }
            return new JsonResponse($data, 200, ['Cache-Control' => 'no-store, private']);
        } catch (EditorialException $error) {
            return new JsonResponse(['errors' => [['code' => $error->reason, 'status' => (string) $error->status]]], $error->status, ['Cache-Control' => 'no-store, private']);
        }
    }
}
